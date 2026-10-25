package com.example.directory.policy;

import com.example.directory.user.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PolicyMapTest {

    @Mock
    private FieldPolicyRepository fieldPolicyRepository;

    @Mock
    private UserPolicyOverrideRepository overrideRepository;

    private PolicyMap policyMap;
    private final UUID researcherId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        policyMap = new PolicyMap(fieldPolicyRepository, overrideRepository);
    }

    @Test
    void missingPoliciesAreDeniedByDefault() {
        when(fieldPolicyRepository.findAll()).thenReturn(List.of(
                policy(Role.RESEARCHER, "legal_name", Access.READ, UnlockState.ANY)));
        when(overrideRepository.findAll()).thenReturn(List.of());

        policyMap.reload();

        assertThat(policyMap.roleAccess(Role.RESEARCHER, "business", "legal_name", UnlockState.ANY))
                .isEqualTo(Access.READ);
        assertThat(policyMap.roleAccess(Role.RESEARCHER, "business", "bank_details", UnlockState.ANY))
                .isEqualTo(Access.HIDDEN);
        assertThat(policyMap.roleAccess(Role.BUSINESS, "business", "legal_name", UnlockState.ANY))
                .isEqualTo(Access.HIDDEN);
    }

    @Test
    void unlockStateFallsBackToTheAnyPolicy() {
        when(fieldPolicyRepository.findAll()).thenReturn(List.of(
                policy(Role.RESEARCHER, "legal_name", Access.READ, UnlockState.ANY)));
        when(overrideRepository.findAll()).thenReturn(List.of());

        policyMap.reload();

        assertThat(policyMap.roleAccess(Role.RESEARCHER, "business", "legal_name", UnlockState.LOCKED))
                .isEqualTo(Access.READ);
        assertThat(policyMap.roleAccess(Role.RESEARCHER, "business", "legal_name", UnlockState.UNLOCKED))
                .isEqualTo(Access.READ);
    }

    @Test
    void stateSpecificPolicyWinsOverTheAnyPolicy() {
        when(fieldPolicyRepository.findAll()).thenReturn(List.of(
                policy(Role.RESEARCHER, "tax_id", Access.HIDDEN, UnlockState.LOCKED),
                policy(Role.RESEARCHER, "tax_id", Access.MASKED, UnlockState.ANY)));
        when(overrideRepository.findAll()).thenReturn(List.of());

        policyMap.reload();

        assertThat(policyMap.roleAccess(Role.RESEARCHER, "business", "tax_id", UnlockState.LOCKED))
                .isEqualTo(Access.HIDDEN);
        assertThat(policyMap.roleAccess(Role.RESEARCHER, "business", "tax_id", UnlockState.UNLOCKED))
                .isEqualTo(Access.MASKED);
    }

    @Test
    void overridesBeatRolePolicies() {
        when(fieldPolicyRepository.findAll()).thenReturn(List.of(
                policy(Role.RESEARCHER, "bank_details", Access.HIDDEN, UnlockState.LOCKED)));
        when(overrideRepository.findAll()).thenReturn(List.of(
                override("bank_details", Access.READ, null)));

        policyMap.reload();

        assertThat(policyMap.overrideAccess(researcherId, "business", "bank_details", UnlockState.LOCKED))
                .isEqualTo(Access.READ);
        assertThat(policyMap.roleAccess(Role.RESEARCHER, "business", "bank_details", UnlockState.LOCKED))
                .isEqualTo(Access.HIDDEN);
    }

    @Test
    void expiredOverridesAreIgnored() {
        when(fieldPolicyRepository.findAll()).thenReturn(List.of());
        when(overrideRepository.findAll()).thenReturn(List.of(
                override("legal_name", Access.WRITE, Instant.now().minus(1, ChronoUnit.HOURS)),
                override("tax_id", Access.READ, Instant.now().plus(1, ChronoUnit.DAYS))));

        policyMap.reload();

        assertThat(policyMap.overrideAccess(researcherId, "business", "legal_name", UnlockState.ANY))
                .isNull();
        assertThat(policyMap.overrideAccess(researcherId, "business", "tax_id", UnlockState.ANY))
                .isEqualTo(Access.READ);
    }

    @Test
    void overridesForOtherUsersDoNotLeak() {
        when(fieldPolicyRepository.findAll()).thenReturn(List.of());
        when(overrideRepository.findAll()).thenReturn(List.of(
                override("legal_name", Access.WRITE, null)));

        policyMap.reload();

        assertThat(policyMap.overrideAccess(UUID.randomUUID(), "business", "legal_name", UnlockState.ANY))
                .isNull();
        assertThat(policyMap.overrideAccess(researcherId, "business", "legal_name", UnlockState.ANY))
                .isEqualTo(Access.WRITE);
    }

    private FieldPolicy policy(Role role, String field, Access access, UnlockState state) {
        FieldPolicy policy = new FieldPolicy();
        policy.setRole(role);
        policy.setResource("business");
        policy.setField(field);
        policy.setAccess(access);
        policy.setUnlockState(state);
        return policy;
    }

    private UserPolicyOverride override(String field, Access access, Instant expiresAt) {
        UserPolicyOverride override = new UserPolicyOverride();
        override.setUserId(researcherId);
        override.setResource("business");
        override.setField(field);
        override.setAccess(access);
        override.setUnlockState(UnlockState.ANY);
        override.setExpiresAt(expiresAt);
        return override;
    }
}
