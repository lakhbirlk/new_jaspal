package com.example.directory.policy;

import com.example.directory.auth.AuthPrincipal;
import com.example.directory.common.ApiException;
import com.example.directory.subscription.UnlockService;
import com.example.directory.user.Role;
import com.example.directory.user.UserStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PolicyEngineTest {

    @Mock
    private PolicyMap policyMap;

    @Mock
    private UnlockService unlockService;

    private PolicyEngine policyEngine;
    private final MaskingService maskingService = new MaskingService();
    private final UUID userId = UUID.randomUUID();
    private final UUID businessId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        policyEngine = new PolicyEngine(policyMap, maskingService, unlockService);
    }

    @Test
    void userOverrideBeatsRolePolicy() {
        when(policyMap.overrideAccess(userId, "business", "bank_details", UnlockState.LOCKED))
                .thenReturn(Access.READ);

        Access access = policyEngine.effectiveAccess(Role.RESEARCHER, userId, "business",
                "bank_details", UnlockState.LOCKED);

        assertThat(access).isEqualTo(Access.READ);
    }

    @Test
    void rolePolicyAppliesWhenNoOverrideExists() {
        when(policyMap.overrideAccess(userId, "business", "legal_name", UnlockState.ANY))
                .thenReturn(null);
        when(policyMap.roleAccess(Role.RESEARCHER, "business", "legal_name", UnlockState.ANY))
                .thenReturn(Access.READ);

        assertThat(policyEngine.effectiveAccess(Role.RESEARCHER, userId, "business",
                "legal_name", UnlockState.ANY)).isEqualTo(Access.READ);
    }

    @Test
    void outputFilterOmitsHiddenFieldsAndMasksMaskedOnes() {
        AuthPrincipal researcher = principal(Role.RESEARCHER);
        when(policyMap.overrideAccess(userId, "business", "legal_name", UnlockState.LOCKED))
                .thenReturn(null);
        when(policyMap.roleAccess(Role.RESEARCHER, "business", "legal_name", UnlockState.LOCKED))
                .thenReturn(Access.READ);
        when(policyMap.overrideAccess(userId, "business", "tax_id", UnlockState.LOCKED))
                .thenReturn(null);
        when(policyMap.roleAccess(Role.RESEARCHER, "business", "tax_id", UnlockState.LOCKED))
                .thenReturn(Access.MASKED);
        when(policyMap.overrideAccess(userId, "business", "bank_details", UnlockState.LOCKED))
                .thenReturn(null);
        when(policyMap.roleAccess(Role.RESEARCHER, "business", "bank_details", UnlockState.LOCKED))
                .thenReturn(Access.HIDDEN);

        Map<String, Object> record = new LinkedHashMap<>();
        record.put("legal_name", "Acme Research Supplies");
        record.put("tax_id", "AAAPZ1234C");
        record.put("bank_details", "HDFC-000123456789");

        Map<String, Object> filtered = policyEngine.filterOutput(record, researcher, "business",
                UnlockState.LOCKED);

        assertThat(filtered)
                .containsEntry("legal_name", "Acme Research Supplies")
                .containsEntry("tax_id", "****234C")
                .containsEntry("unlocked", false)
                .doesNotContainKey("bank_details");
    }

    @Test
    void unlockedBusinessesAreFlagged() {
        AuthPrincipal researcher = principal(Role.RESEARCHER);
        when(policyMap.overrideAccess(userId, "business", "legal_name", UnlockState.UNLOCKED))
                .thenReturn(null);
        when(policyMap.roleAccess(Role.RESEARCHER, "business", "legal_name", UnlockState.UNLOCKED))
                .thenReturn(Access.READ);

        Map<String, Object> filtered = policyEngine.filterOutput(
                Map.of("legal_name", "Acme"), researcher, "business", UnlockState.UNLOCKED);

        assertThat(filtered).containsEntry("unlocked", true);
    }

    @Test
    void writesRejectFieldsThatAreNotWritable() {
        AuthPrincipal researcher = principal(Role.RESEARCHER);
        when(policyMap.overrideAccess(userId, "business", "legal_name", UnlockState.ANY))
                .thenReturn(null);
        when(policyMap.roleAccess(Role.RESEARCHER, "business", "legal_name", UnlockState.ANY))
                .thenReturn(Access.READ);

        assertThatThrownBy(() -> policyEngine.filterInput(
                Map.of("legal_name", "Changed"), researcher, "business"))
                .isInstanceOfSatisfying(ApiException.class, error -> {
                    assertThat(error.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(error.getCode()).isEqualTo("FIELD_NOT_WRITABLE");
                    assertThat(error.getDetails()).isEqualTo(Map.of("field", "legal_name"));
                });
    }

    @Test
    void writesAllowWritableFields() {
        AuthPrincipal researcher = principal(Role.RESEARCHER);
        when(policyMap.overrideAccess(userId, "business", "legal_name", UnlockState.ANY))
                .thenReturn(null);
        when(policyMap.roleAccess(Role.RESEARCHER, "business", "legal_name", UnlockState.ANY))
                .thenReturn(Access.WRITE);

        policyEngine.filterInput(Map.of("legal_name", "Changed"), researcher, "business");
    }

    @Test
    void researcherIsLockedUntilAnUnlockIsActive() {
        AuthPrincipal researcher = principal(Role.RESEARCHER);
        when(unlockService.isUnlockedNow(userId, businessId)).thenReturn(false);

        assertThat(policyEngine.isResearcherLocked(researcher, businessId)).isTrue();
        assertThat(policyEngine.unlockState(researcher, "business", businessId))
                .isEqualTo(UnlockState.LOCKED);
    }

    @Test
    void otherRolesAreNeverLocked() {
        AuthPrincipal business = principal(Role.BUSINESS);

        assertThat(policyEngine.isResearcherLocked(business, businessId)).isFalse();
        assertThat(policyEngine.unlockState(business, "business", businessId))
                .isEqualTo(UnlockState.ANY);
    }

    private AuthPrincipal principal(Role role) {
        return new AuthPrincipal(userId, role, UserStatus.ACTIVE, false);
    }
}
