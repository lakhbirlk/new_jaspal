package com.example.directory;

import com.example.directory.user.User;
import com.example.directory.user.UserRepository;
import com.example.directory.user.UserStatus;
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
 * End-to-end coverage for the security-critical paths described in the design:
 * register → verify → login, restricted-session permissions, refresh-token rotation and
 * reuse detection, password reset, owner-scope checks and mass-assignment rejection.
 */
@SpringBootTest(properties = {
        "app.dev.expose-email-tokens=true",
        "app.dev.seed-demo=true",
        "app.rate-limit.login-per-minute=1000",
        "app.rate-limit.register-per-minute=1000",
        "app.rate-limit.search-per-minute=1000"
})
@ActiveProfiles("embedded")
@AutoConfigureMockMvc
class AuthAndAuthorizationIntegrationTest {

    private static final String PASSWORD = "Register@12345";
    private static final String DEMO_PASSWORD = "Demo@12345";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Test
    void registerVerifyLoginAndRestrictedSessionPermissions() throws Exception {
        String email = uniqueEmail("register");
        String verificationToken = registerResearcher(email, "New Researcher");

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "email", email,
                                "fullName", "New Researcher",
                                "password", PASSWORD,
                                "role", "researcher"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_IN_USE"));

        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", verificationToken))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("pending_profile"));

        JsonNode login = login(email, PASSWORD);
        assertThat(login.get("status").asText()).isEqualTo("authenticated");
        assertThat(login.get("restricted").asBoolean()).isTrue();
        String accessToken = login.get("accessToken").asText();

        mockMvc.perform(get("/api/v1/admin/users").header("Authorization", bearer(accessToken)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        mockMvc.perform(get("/api/v1/me").header("Authorization", bearer(accessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.role").value("researcher"))
                .andExpect(jsonPath("$.restricted").value(true));

        mockMvc.perform(get("/api/v1/businesses").header("Authorization", bearer(accessToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    void refreshTokensRotateAndReplayedTokensRevokeTheFamily() throws Exception {
        JsonNode login = login("researcher@directory.local", DEMO_PASSWORD);
        String firstRefresh = login.get("refreshToken").asText();

        JsonNode second = refresh(firstRefresh);
        String secondRefresh = second.get("refreshToken").asText();
        assertThat(secondRefresh).isNotEqualTo(firstRefresh);

        MvcResult replay = mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("refreshToken", firstRefresh))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("REFRESH_TOKEN_REUSED"))
                .andReturn();
        assertThat(replay.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .contains("REFRESH_TOKEN_REUSED");

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("refreshToken", secondRefresh))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void researcherSeesOnlyUnlockedFieldsForAListedBusiness() throws Exception {
        JsonNode login = login("researcher@directory.local", DEMO_PASSWORD);
        String token = login.get("accessToken").asText();

        MvcResult result = mockMvc.perform(get("/api/v1/businesses")
                        .param("q", "Acme")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].legal_name").exists())
                .andReturn();

        JsonNode item = body(result).get("items").get(0);
        String businessId = item.get("id").asText();
        assertThat(item.get("unlocked").asBoolean()).isFalse();
        assertThat(item.get("registration_number").asText()).startsWith("****");
        assertThat(item.has("public_email")).isFalse();
        assertThat(item.has("tax_id")).isFalse();
        assertThat(item.has("bank_details")).isFalse();

        mockMvc.perform(get("/api/v1/businesses/" + businessId)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unlocked").value(false))
                .andExpect(jsonPath("$.public_email").doesNotExist())
                .andExpect(jsonPath("$.tax_id").doesNotExist());
    }

    @Test
    void businessOwnerCannotReadAnotherBusinessOrChangeAdminFields() throws Exception {
        JsonNode owner = login("business@directory.local", DEMO_PASSWORD);
        String ownerToken = owner.get("accessToken").asText();
        String ownId = body(mockMvc.perform(get("/api/v1/my/business")
                        .header("Authorization", bearer(ownerToken)))
                .andExpect(status().isOk())
                .andReturn()).get("id").asText();

        String otherEmail = uniqueEmail("other-business");
        registerBusiness(otherEmail, "Other Trading Company");
        User other = userRepository.findByEmailIgnoreCase(otherEmail).orElseThrow();
        other.setStatus(UserStatus.ACTIVE);
        userRepository.save(other);

        JsonNode otherLogin = login(otherEmail, PASSWORD);
        String otherToken = otherLogin.get("accessToken").asText();
        String otherId = body(mockMvc.perform(get("/api/v1/my/business")
                        .header("Authorization", bearer(otherToken)))
                .andExpect(status().isOk())
                .andReturn()).get("id").asText();
        assertThat(otherId).isNotEqualTo(ownId);

        mockMvc.perform(get("/api/v1/businesses/" + otherId)
                        .header("Authorization", bearer(ownerToken)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("BUSINESS_NOT_FOUND"));

        mockMvc.perform(get("/api/v1/businesses/" + ownId)
                        .header("Authorization", bearer(ownerToken)))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/v1/my/business")
                        .header("Authorization", bearer(ownerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("admin_listing_status", "listed"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FIELD_NOT_WRITABLE"))
                .andExpect(jsonPath("$.details.field").value("admin_listing_status"));
    }

    @Test
    void passwordResetInvalidatesTheOldPassword() throws Exception {
        String email = uniqueEmail("reset");
        String verificationToken = registerResearcher(email, "Reset Researcher");
        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", verificationToken))))
                .andExpect(status().isOk());

        MvcResult forgot = mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", email))))
                .andExpect(status().isOk())
                .andReturn();
        String resetToken = body(forgot).get("devResetToken").asText();

        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", resetToken, "newPassword", "Reset@12345"))))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));

        assertThat(login(email, "Reset@12345").get("accessToken").asText()).isNotBlank();
    }

    @Test
    void publicCatalogueIsAnonymousAndCannotBeProbedByName() throws Exception {
        MvcResult listResult = mockMvc.perform(get("/api/v1/public/businesses").param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].public_code").exists())
                .andReturn();
        JsonNode list = body(listResult);
        assertThat(list.get("total").asLong()).isGreaterThan(0);

        JsonNode first = list.get("items").get(0);
        assertThat(first.get("public_code").asText()).startsWith("DOB-");
        assertThat(first.has("legal_name")).isFalse();
        assertThat(first.has("trade_name")).isFalse();
        assertThat(first.has("registration_number")).isFalse();
        assertThat(first.has("tax_id")).isFalse();
        assertThat(first.has("public_email")).isFalse();
        assertThat(first.has("public_phone")).isFalse();
        assertThat(first.has("bank_details")).isFalse();
        assertThat(first.has("description")).isFalse();

        mockMvc.perform(get("/api/v1/public/businesses/" + first.get("id").asText()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.public_code").value(first.get("public_code").asText()))
                .andExpect(jsonPath("$.legal_name").doesNotExist())
                .andExpect(jsonPath("$.public_email").doesNotExist());

        mockMvc.perform(get("/api/v1/public/businesses/" + UUID.randomUUID()))
                .andExpect(status().isNotFound());

        // Free text matches sector, category and location only — never the company name.
        MvcResult sectorSearch = mockMvc.perform(get("/api/v1/public/businesses").param("q", "pharma"))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(body(sectorSearch).get("total").asLong()).isGreaterThan(0);

        MvcResult nameSearch = mockMvc.perform(get("/api/v1/public/businesses").param("q", "NorthStar"))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(body(nameSearch).get("total").asLong()).isZero();
    }

    private String registerResearcher(String email, String fullName) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "email", email,
                                "fullName", fullName,
                                "password", PASSWORD,
                                "role", "researcher"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.devVerificationToken").exists())
                .andReturn();
        return body(result).get("devVerificationToken").asText();
    }

    private void registerBusiness(String email, String businessName) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "email", email,
                                "fullName", "Other Owner",
                                "password", PASSWORD,
                                "role", "business",
                                "businessName", businessName))))
                .andExpect(status().isCreated())
                .andReturn();
        String verificationToken = body(result).get("devVerificationToken").asText();
        mockMvc.perform(post("/api/v1/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("token", verificationToken))))
                .andExpect(status().isOk());
    }

    private JsonNode login(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", email, "password", password))))
                .andExpect(status().isOk())
                .andReturn();
        return body(result);
    }

    private JsonNode refresh(String refreshToken) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("refreshToken", refreshToken))))
                .andExpect(status().isOk())
                .andReturn();
        return body(result);
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

    private String uniqueEmail(String prefix) {
        return prefix + "." + UUID.randomUUID() + "@directory.local";
    }
}
