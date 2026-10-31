package com.example.directory.subscription;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Covers the self-serve research plan purchase: subscribing creates a pending subscription and
 * a pending payment, nothing is active until the payment is confirmed, and confirmation grants
 * the plan's credits exactly once.
 */
@SpringBootTest(properties = {
        "app.dev.expose-email-tokens=true",
        "app.rate-limit.login-per-minute=1000",
        "app.rate-limit.register-per-minute=1000",
        "app.rate-limit.search-per-minute=1000"
})
@ActiveProfiles("test")
@AutoConfigureMockMvc
class SubscriptionCheckoutIntegrationTest {

    private static final String ADMIN_EMAIL = "admin@directory.local";
    private static final String ADMIN_PASSWORD = "Admin@12345";
    private static final String REGISTER_PASSWORD = "Register@12345";
    private static final String BASIC_PLAN = "BASIC";
    private static final int BASIC_CREDITS = 5;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void checkoutStaysPendingUntilPaidThenActivatesOnce() throws Exception {
        String token = researcherToken();

        JsonNode checkout = body(mockMvc.perform(post("/api/v1/subscriptions")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("planCode", BASIC_PLAN))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subscription.status").value("pending_payment"))
                .andExpect(jsonPath("$.subscription.active").value(false))
                .andExpect(jsonPath("$.payment.status").value("pending"))
                .andExpect(jsonPath("$.payment.purpose").value("researcher_plan"))
                .andReturn());
        String paymentId = checkout.get("payment").get("id").asText();
        String subscriptionId = checkout.get("subscription").get("id").asText();

        mockMvc.perform(get("/api/v1/subscriptions/me").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false))
                .andExpect(jsonPath("$.creditsRemaining").value(0));

        // Pressing Subscribe again reuses the open checkout instead of opening a second one.
        mockMvc.perform(post("/api/v1/subscriptions")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("planCode", BASIC_PLAN))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subscription.id").value(subscriptionId))
                .andExpect(jsonPath("$.payment.id").value(paymentId));

        mockMvc.perform(post("/api/v1/payments/" + paymentId + "/pay")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("paid"));

        mockMvc.perform(get("/api/v1/subscriptions/me").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.creditsRemaining").value(BASIC_CREDITS))
                .andExpect(jsonPath("$.subscription.status").value("active"));

        // Re-sending the confirmation must not grant the credits a second time.
        mockMvc.perform(post("/api/v1/payments/" + paymentId + "/pay")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("paid"));

        mockMvc.perform(get("/api/v1/subscriptions/me").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.creditsRemaining").value(BASIC_CREDITS));

        mockMvc.perform(post("/api/v1/subscriptions")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("planCode", BASIC_PLAN))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PLAN_NOT_SUCCESSIVE"));
    }

    @Test
    void subscriberCanUpgradeToTheNextPlanCarryingCredits() throws Exception {
        String token = researcherToken();
        JsonNode checkout = startCheckout(token);
        String subscriptionId = checkout.get("subscription").get("id").asText();
        mockMvc.perform(post("/api/v1/payments/" + checkout.get("payment").get("id").asText() + "/pay")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("paid"));

        // Spend two of the five BASIC credits so the carry-over is visible in the upgrade.
        mockMvc.perform(post("/api/v1/admin/subscriptions/" + subscriptionId + "/credits")
                        .header("Authorization", bearer(adminToken()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("amount", -2, "reason", "Spent before upgrading"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.creditsRemaining").value(3));

        JsonNode upgraded = body(mockMvc.perform(post("/api/v1/subscriptions")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("planCode", "RESEARCH_3M"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.upgrade").value(true))
                .andExpect(jsonPath("$.creditsCarried").value(3))
                .andExpect(jsonPath("$.plan.code").value("RESEARCH_3M"))
                .andExpect(jsonPath("$.currentPlan.code").value(BASIC_PLAN))
                .andReturn());

        // The old plan stays active until the upgrade payment is confirmed.
        mockMvc.perform(get("/api/v1/subscriptions/me").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.subscription.plan.code").value(BASIC_PLAN))
                .andExpect(jsonPath("$.creditsRemaining").value(3));

        mockMvc.perform(post("/api/v1/payments/" + upgraded.get("payment").get("id").asText() + "/pay")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("paid"));

        mockMvc.perform(get("/api/v1/subscriptions/me").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.subscription.plan.code").value("RESEARCH_3M"))
                .andExpect(jsonPath("$.creditsGranted").value(3 + 25))
                .andExpect(jsonPath("$.creditsRemaining").value(3 + 25));

        // Downgrading while the higher tier is active is rejected.
        mockMvc.perform(post("/api/v1/subscriptions")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("planCode", BASIC_PLAN))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PLAN_NOT_SUCCESSIVE"));
    }

    @Test
    void anotherResearcherCannotSettleSomeoneElsesCheckout() throws Exception {
        String owner = researcherToken();
        JsonNode checkout = startCheckout(owner);
        String paymentId = checkout.get("payment").get("id").asText();

        String stranger = researcherToken();
        mockMvc.perform(post("/api/v1/payments/" + paymentId + "/pay")
                        .header("Authorization", bearer(stranger))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PAYMENT_NOT_FOUND"));
    }

    @Test
    void anonymousCallersCannotSettleACheckout() throws Exception {
        mockMvc.perform(post("/api/v1/payments/" + UUID.randomUUID() + "/pay")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void adminCanSettleTheCheckoutOffline() throws Exception {
        String token = researcherToken();
        JsonNode checkout = startCheckout(token);
        String subscriptionId = checkout.get("subscription").get("id").asText();

        mockMvc.perform(post("/api/v1/admin/payments")
                        .header("Authorization", bearer(adminToken()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "purpose", "researcher_plan",
                                "referenceId", subscriptionId,
                                "providerRef", "BANK-" + UUID.randomUUID()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("paid"))
                .andExpect(jsonPath("$.purpose").value("researcher_plan"));

        mockMvc.perform(get("/api/v1/subscriptions/me").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.creditsRemaining").value(BASIC_CREDITS));
    }

    // ------------------------------------------------------------------ helpers

    private JsonNode startCheckout(String token) throws Exception {
        return body(mockMvc.perform(post("/api/v1/subscriptions")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("planCode", BASIC_PLAN))))
                .andExpect(status().isOk())
                .andReturn());
    }

    private String researcherToken() throws Exception {
        String email = "checkout." + UUID.randomUUID() + "@directory.local";
        MvcResult registered = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "email", email,
                                "fullName", "Checkout Tester",
                                "password", REGISTER_PASSWORD,
                                "role", "researcher"))))
                .andExpect(status().isCreated())
                .andReturn();
        String verificationToken = body(registered).get("devVerificationToken").asText();
        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", verificationToken))))
                .andExpect(status().isOk());

        // Subscribing requires an approved account. The approval endpoint only accepts profiles
        // that were submitted for review, so activate the account directly as the reviewer would.
        JsonNode pendingUser = loginBody(email, REGISTER_PASSWORD);
        String userId = pendingUser.get("user").get("id").asText();
        mockMvc.perform(patch("/api/v1/admin/users/" + userId)
                        .header("Authorization", bearer(adminToken()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("status", "active"))))
                .andExpect(status().isOk());
        return login(email, REGISTER_PASSWORD);
    }

    private String adminToken() throws Exception {
        return login(ADMIN_EMAIL, ADMIN_PASSWORD);
    }

    private String login(String email, String password) throws Exception {
        JsonNode response = loginBody(email, password);
        assertThat(response.hasNonNull("accessToken")).isTrue();
        return response.get("accessToken").asText();
    }

    private JsonNode loginBody(String email, String password) throws Exception {
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
}
