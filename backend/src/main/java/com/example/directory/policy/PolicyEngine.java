package com.example.directory.policy;

import com.example.directory.auth.AuthPrincipal;
import com.example.directory.common.ApiException;
import com.example.directory.subscription.UnlockService;
import com.example.directory.user.Role;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PolicyEngine {

    private final PolicyMap policyMap;
    private final MaskingService maskingService;
    private final UnlockService unlockService;

    public Access effectiveAccess(Role role, UUID userId, String resource, String field,
                                  UnlockState state) {
        Access override = userId == null ? null
                : policyMap.overrideAccess(userId, resource, field, state);
        if (override != null) {
            return override;
        }
        return policyMap.roleAccess(role, resource, field, state);
    }

    public UnlockState unlockState(AuthPrincipal principal, String resource, UUID businessId) {
        if (principal.role() != Role.RESEARCHER || !"business".equals(resource) || businessId == null) {
            return UnlockState.ANY;
        }
        return unlockService.isUnlockedNow(principal.id(), businessId)
                ? UnlockState.UNLOCKED : UnlockState.LOCKED;
    }

    public Set<UUID> unlockedBusinessIds(UUID userId, Collection<UUID> businessIds) {
        return unlockService.unlockedBusinessIds(userId, businessIds);
    }

    public Map<String, Object> filterOutput(Map<String, Object> record, AuthPrincipal principal,
                                            String resource, UnlockState state) {
        Map<String, Object> output = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : record.entrySet()) {
            Access access = effectiveAccess(principal.role(), principal.id(), resource,
                    entry.getKey(), state);
            if (!access.canRead()) {
                continue;
            }
            output.put(entry.getKey(), access == Access.MASKED
                    ? maskingService.mask(entry.getKey(), entry.getValue())
                    : entry.getValue());
        }
        if ("business".equals(resource)) {
            output.put("unlocked", state == UnlockState.UNLOCKED);
        }
        return output;
    }

    public Map<String, Object> filterOutputForRole(Map<String, Object> record, Role role,
                                                   UUID userId, String resource, UnlockState state) {
        Map<String, Object> output = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : record.entrySet()) {
            Access access = effectiveAccess(role, userId, resource, entry.getKey(), state);
            if (!access.canRead()) {
                continue;
            }
            output.put(entry.getKey(), access == Access.MASKED
                    ? maskingService.mask(entry.getKey(), entry.getValue())
                    : entry.getValue());
        }
        if ("business".equals(resource)) {
            output.put("unlocked", state == UnlockState.UNLOCKED);
        }
        return output;
    }

    public void filterInput(Map<String, Object> payload, AuthPrincipal principal, String resource) {
        if (payload == null) {
            return;
        }
        for (String field : payload.keySet()) {
            Access access = effectiveAccess(principal.role(), principal.id(), resource, field,
                    UnlockState.ANY);
            if (!access.canWrite()) {
                throw ApiException.fieldForbidden(field);
            }
        }
    }

    public Map<String, Access> accessMap(Role role, UUID userId, String resource, UnlockState state) {
        Map<String, Access> fields = new LinkedHashMap<>(policyMap.fieldsFor(role, resource, state));
        fields.replaceAll((field, access) -> effectiveAccess(role, userId, resource, field, state));
        return fields;
    }

    public boolean isResearcherLocked(AuthPrincipal principal, UUID businessId) {
        return principal.role() == Role.RESEARCHER
                && !unlockService.isUnlockedNow(principal.id(), businessId);
    }
}
