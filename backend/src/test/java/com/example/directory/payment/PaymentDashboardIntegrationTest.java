package com.example.directory.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.directory.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end coverage for the admin payment dashboard: figures come from persisted rows,
 * refunds leave revenue, filters are validated, exports are audited and every endpoint is
 * limited to admins carrying {@code payment:read}.
 */
@SpringBootTest(properties = {
        "app.dev.expose-email-tokens=true",
        "app.dev.seed-demo=true",
        "app.rate-limit.login-per-minute=1000",
        "app.rate-limit.register-per-minute=1000",
        "app.rate-limit.search-per-minute=1000"
})
@ActiveProfiles("test")
@AutoConfigureMockMvc
class PaymentDashboardIntegrationTest {

    private static final String ADMIN_EMAIL = "admin@directory.local";
    private static final String ADMIN_PASSWORD = "Admin@12345";
    private static final String REGISTER_PASSWORD = "Register@12345";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private UserRepository userRepository;

    @Test
    void dashboardIsComputedFromPersistedPayments() throws Exception {
        String token = adminToken();
        UUID customer = demoCustomerId();
        String gateway = uniqueGateway();

        JsonNode before = dashboard(token);
        seed(customer, gateway, "100.00", PaymentStatus.PAID);
        seed(customer, gateway, "50.25", PaymentStatus.PAID);
        seed(customer, gateway, "30.00", PaymentStatus.FAILED);
        seed(customer, gateway, "10.00", PaymentStatus.PENDING);
        seed(customer, gateway, "40.00", PaymentStatus.REFUNDED);
        JsonNode after = dashboard(token);

        assertThat(delta(after, before, "successfulPayments")).isEqualTo(2);
        assertThat(delta(after, before, "failedPayments")).isEqualTo(1);
        assertThat(delta(after, before, "pendingPayments")).isEqualTo(1);
        assertThat(delta(after, before, "refundedPayments")).isEqualTo(1);
        assertThat(delta(after, before, "totalTransactions")).isEqualTo(5);

        // Only the two PAID rows count; the refunded row is excluded and failed/pending never count.
        assertThat(revenue(after, "total", "INR").subtract(revenue(before, "total", "INR")))
                .isEqualByComparingTo("150.25");
        assertThat(revenue(after, "today", "INR").subtract(revenue(before, "today", "INR")))
                .isEqualByComparingTo("150.25");
        assertThat(after.get("currencies").toString()).contains("INR");
    }

    @Test
    void refundMovesPaymentOutOfRevenueAndKeepsTheDetail() throws Exception {
        String token = adminToken();
        UUID customer = demoCustomerId();
        String gateway = uniqueGateway();

        JsonNode preSeed = dashboard(token);
        Payment payment = seed(customer, gateway, "77.77", PaymentStatus.PAID);
        JsonNode before = dashboard(token);
        assertThat(revenue(before, "total", "INR").subtract(revenue(preSeed, "total", "INR")))
                .isEqualByComparingTo("77.77");

        mockMvc.perform(post("/api/v1/admin/payments/" + payment.getId() + "/refund")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("reason", "Duplicate charge"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("refunded"))
                .andExpect(jsonPath("$.refundReason").value("Duplicate charge"));

        JsonNode after = dashboard(token);
        assertThat(revenue(after, "total", "INR")).isEqualByComparingTo(revenue(preSeed, "total", "INR"));

        mockMvc.perform(get("/api/v1/admin/payments/transactions/" + payment.getId())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("refunded"))
                .andExpect(jsonPath("$.refund.type").value("full"))
                .andExpect(jsonPath("$.refund.reason").value("Duplicate charge"))
                .andExpect(jsonPath("$.refund.refundedAt").exists())
                .andExpect(jsonPath("$.gatewayResponse.status").value("refunded"));
    }

    @Test
    void transactionLogFiltersSortsPaginatesAndExports() throws Exception {
        String token = adminToken();
        UUID customer = demoCustomerId();
        String gateway = uniqueGateway();

        Payment smallest = seed(customer, gateway, "10.00", PaymentStatus.FAILED);
        seed(customer, gateway, "20.00", PaymentStatus.PENDING);
        seed(customer, gateway, "30.00", PaymentStatus.PAID);

        MvcResult sorted = mockMvc.perform(get("/api/v1/admin/payments/transactions")
                        .param("gateway", gateway)
                        .param("sort", "amount")
                        .param("direction", "asc")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.items[0].customerName").value("Demo Researcher"))
                .andExpect(jsonPath("$.items[0].gateway").value(gateway))
                .andExpect(jsonPath("$.items[0].orderId").exists())
                .andReturn();
        JsonNode sortedItems = body(sorted).get("items");
        assertThat(new BigDecimal(sortedItems.get(0).get("amount").asText())).isEqualByComparingTo("10.00");
        assertThat(new BigDecimal(sortedItems.get(2).get("amount").asText())).isEqualByComparingTo("30.00");

        mockMvc.perform(get("/api/v1/admin/payments/transactions")
                        .param("gateway", gateway)
                        .param("status", "failed")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].id").value(smallest.getId().toString()));

        mockMvc.perform(get("/api/v1/admin/payments/transactions")
                        .param("gateway", gateway)
                        .param("page", "0")
                        .param("size", "2")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.items.length()").value(2));

        mockMvc.perform(get("/api/v1/admin/payments/transactions")
                        .param("search", smallest.getId().toString())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1));

        MvcResult export = mockMvc.perform(get("/api/v1/admin/payments/transactions/export")
                        .param("gateway", gateway)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", containsString("text/csv")))
                .andReturn();
        String csv = export.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(csv).startsWith("Transaction ID,Order ID,Customer,Customer Email,Amount,Currency,"
                + "Gateway,Gateway Reference,Status,Created At,Paid At,Refunded At,Failure Reason");
        assertThat(csv.lines().count()).isEqualTo(4);
        assertThat(csv).contains(smallest.getId().toString()).contains("Demo Researcher");

        mockMvc.perform(get("/api/v1/admin/audit-logs")
                        .param("action", "PAYMENT_REPORT_EXPORTED")
                        .param("page", "0")
                        .param("size", "5")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].action").value("PAYMENT_REPORT_EXPORTED"))
                .andExpect(jsonPath("$.items[0].after.rows").value(3))
                .andExpect(jsonPath("$.items[0].after.gateway").value(gateway));
    }

    @Test
    void paymentApisRejectNonAdminsAndAnonymousCallers() throws Exception {
        String researcherToken = researcherToken();
        String[] paths = {
                "/api/v1/admin/payments/dashboard",
                "/api/v1/admin/payments/analytics",
                "/api/v1/admin/payments/transactions",
                "/api/v1/admin/payments/transactions/export",
                "/api/v1/admin/payments/transactions/" + UUID.randomUUID()
        };

        for (String path : paths) {
            mockMvc.perform(get(path).header("Authorization", bearer(researcherToken)))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("FORBIDDEN"));
            mockMvc.perform(get(path))
                    .andExpect(status().isUnauthorized());
        }
    }

    @Test
    void invalidFilterParametersAreRejected() throws Exception {
        String token = adminToken();

        mockMvc.perform(get("/api/v1/admin/payments/transactions")
                        .param("status", "settled")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_STATUS"));

        mockMvc.perform(get("/api/v1/admin/payments/transactions")
                        .param("sort", "customerName")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_SORT"));

        mockMvc.perform(get("/api/v1/admin/payments/transactions")
                        .param("dateFrom", "13-13-2026")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_DATE"));

        mockMvc.perform(get("/api/v1/admin/payments/analytics")
                        .param("period", "hourly")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PERIOD"));

        mockMvc.perform(get("/api/v1/admin/payments/analytics")
                        .param("period", "custom")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MISSING_DATE"));

        mockMvc.perform(get("/api/v1/admin/payments/analytics")
                        .param("period", "custom")
                        .param("from", "2026-02-01")
                        .param("to", "2026-01-01")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_DATE_RANGE"));

        mockMvc.perform(get("/api/v1/admin/payments/analytics")
                        .param("currency", "rupees")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_CURRENCY"));
    }

    // ------------------------------------------------------------------ helpers

    private JsonNode dashboard(String token) throws Exception {
        return body(mockMvc.perform(get("/api/v1/admin/payments/dashboard")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andReturn());
    }

    private long delta(JsonNode after, JsonNode before, String field) {
        return after.get(field).asLong() - before.get(field).asLong();
    }

    private BigDecimal revenue(JsonNode metrics, String window, String currency) {
        return new BigDecimal(metrics.path("revenueByCurrency").path(window).path(currency).asText("0"));
    }

    private Payment seed(UUID customer, String gateway, String amount, PaymentStatus status) {
        Payment payment = new Payment();
        payment.setUserId(customer);
        payment.setPurpose(PaymentPurpose.LISTING);
        payment.setReferenceId(UUID.randomUUID());
        payment.setAmount(new BigDecimal(amount));
        payment.setCurrency("INR");
        payment.setProvider(gateway);
        payment.setProviderRef(gateway + "-" + UUID.randomUUID());
        payment.setStatus(status);
        payment.setCreatedAt(Instant.now());
        if (status == PaymentStatus.PAID || status == PaymentStatus.REFUNDED) {
            payment.setPaidAt(Instant.now());
        }
        if (status == PaymentStatus.REFUNDED) {
            payment.setRefundedAt(Instant.now());
            payment.setRefundReason("Test fixture refund");
        }
        return paymentRepository.save(payment);
    }

    private UUID demoCustomerId() {
        return userRepository.findByEmailIgnoreCase("researcher@directory.local").orElseThrow().getId();
    }

    private String adminToken() throws Exception {
        return login(ADMIN_EMAIL, ADMIN_PASSWORD).get("accessToken").asText();
    }

    private String researcherToken() throws Exception {
        String email = "pay.user." + UUID.randomUUID() + "@directory.local";
        MvcResult registered = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "email", email,
                                "fullName", "Payment Read Tester",
                                "password", REGISTER_PASSWORD,
                                "role", "researcher"))))
                .andExpect(status().isCreated())
                .andReturn();
        String verificationToken = body(registered).get("devVerificationToken").asText();
        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", verificationToken))))
                .andExpect(status().isOk());
        return login(email, REGISTER_PASSWORD).get("accessToken").asText();
    }

    private JsonNode login(String email, String password) throws Exception {
        return body(mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", email, "password", password))))
                .andExpect(status().isOk())
                .andReturn());
    }

    private JsonNode body(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private String uniqueGateway() {
        return "TGW" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
    }
}
