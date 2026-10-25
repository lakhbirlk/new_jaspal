package com.example.directory.policy;

import com.example.directory.user.Role;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * In-memory policy map, reloaded whenever an admin saves a policy change.
 */
@Component
@RequiredArgsConstructor
public class PolicyMap {

    private final FieldPolicyRepository fieldPolicyRepository;
    private final UserPolicyOverrideRepository overrideRepository;

    private volatile Map<RoleKey, Access> roleRules = Map.of();
    private volatile Map<OverrideKey, OverrideValue> overrides = Map.of();

    @PostConstruct
    public void reload() {
        Map<RoleKey, Access> rules = new HashMap<>();
        for (FieldPolicy policy : fieldPolicyRepository.findAll()) {
            rules.put(new RoleKey(policy.getRole(), policy.getResource(), policy.getField(),
                    policy.getUnlockState()), policy.getAccess());
        }

        Instant now = Instant.now();
        Map<OverrideKey, OverrideValue> userOverrides = new HashMap<>();
        for (UserPolicyOverride override : overrideRepository.findAll()) {
            if (override.getExpiresAt() != null && !override.getExpiresAt().isAfter(now)) {
                continue;
            }
            userOverrides.put(new OverrideKey(override.getUserId(), override.getResource(),
                            override.getField(), override.getUnlockState()),
                    new OverrideValue(override.getAccess(), override.getExpiresAt()));
        }

        this.roleRules = Map.copyOf(rules);
        this.overrides = Map.copyOf(userOverrides);
    }

    public Access roleAccess(Role role, String resource, String field, UnlockState state) {
        Access access = roleRules.get(new RoleKey(role, resource, field, state));
        if (access == null && state != UnlockState.ANY) {
            access = roleRules.get(new RoleKey(role, resource, field, UnlockState.ANY));
        }
        return access == null ? Access.HIDDEN : access;
    }

    public Access overrideAccess(UUID userId, String resource, String field, UnlockState state) {
        Instant now = Instant.now();
        OverrideValue value = overrides.get(new OverrideKey(userId, resource, field, state));
        if (value == null && state != UnlockState.ANY) {
            value = overrides.get(new OverrideKey(userId, resource, field, UnlockState.ANY));
        }
        if (value == null || (value.expiresAt != null && !value.expiresAt.isAfter(now))) {
            return null;
        }
        return value.access;
    }

    public Map<String, Access> fieldsFor(Role role, String resource, UnlockState state) {
        Map<String, Access> result = new java.util.LinkedHashMap<>();
        roleRules.forEach((key, access) -> {
            if (key.role == role && key.resource.equals(resource)
                    && (key.state == state || (state != UnlockState.ANY && key.state == UnlockState.ANY)
                    || (state == UnlockState.ANY && key.state == UnlockState.ANY))) {
                result.merge(key.field, access, Access::max);
            }
        });
        return result;
    }

    public List<FieldPolicy> allPolicies() {
        return fieldPolicyRepository.findAllByOrderByRoleAscResourceAscFieldAscUnlockStateAsc();
    }

    private record RoleKey(Role role, String resource, String field, UnlockState state) {
    }

    private record OverrideKey(UUID userId, String resource, String field, UnlockState state) {
    }

    private record OverrideValue(Access access, Instant expiresAt) {
    }
}
