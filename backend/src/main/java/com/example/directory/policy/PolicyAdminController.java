package com.example.directory.policy;

import com.example.directory.audit.AuditService;
import com.example.directory.auth.AuthPrincipal;
import com.example.directory.auth.CurrentUser;
import com.example.directory.common.ApiException;
import com.example.directory.user.Role;
import com.example.directory.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/v1/admin/policies")
@RequiredArgsConstructor
public class PolicyAdminController {

    private final FieldPolicyRepository fieldPolicyRepository;
    private final UserPolicyOverrideRepository overrideRepository;
    private final PolicyMap policyMap;
    private final PolicyEngine policyEngine;
    private final UserRepository userRepository;
    private final AuditService auditService;

    public record PolicyItem(String role, String resource, String field, String access,
                             String unlockState) {
    }

    public record PolicyUpdate(List<PolicyItem> policies) {
    }

    public record OverrideItem(String resource, String field, String access,
                               String unlockState, Instant expiresAt) {
    }

    public record OverrideUpdate(List<OverrideItem> overrides) {
    }

    @GetMapping("/fields")
    @PreAuthorize("hasAuthority('policy:manage')")
    public List<Map<String, Object>> fields() {
        return policyMap.allPolicies().stream().map(this::policyMap).toList();
    }

    @PutMapping("/fields")
    @PreAuthorize("hasAuthority('policy:manage')")
    @Transactional
    public List<Map<String, Object>> updateFields(@RequestBody PolicyUpdate request,
                                                  @AuthenticationPrincipal AuthPrincipal principal) {
        if (request == null || request.policies() == null || request.policies().isEmpty()) {
            throw ApiException.badRequest("NO_POLICIES", "At least one policy update is required");
        }
        List<FieldPolicy> all = fieldPolicyRepository.findAll();
        Map<String, FieldPolicy> existing = new HashMap<>();
        for (FieldPolicy policy : all) {
            existing.put(key(policy.getRole(), policy.getResource(), policy.getField(),
                    policy.getUnlockState()), policy);
        }
        Map<String, String> before = snapshot(all);
        List<FieldPolicy> changed = new ArrayList<>();

        for (PolicyItem item : request.policies()) {
            Role role = parseRole(item.role());
            String resource = require(item.resource(), "resource");
            String field = require(item.field(), "field");
            Access access = parseAccess(item.access());
            UnlockState state = parseState(item.unlockState());

            String key = key(role, resource, field, state);
            FieldPolicy policy = existing.get(key);
            if (policy == null) {
                policy = new FieldPolicy();
                policy.setRole(role);
                policy.setResource(resource);
                policy.setField(field);
                policy.setUnlockState(state);
            }
            policy.setAccess(access);
            policy.setUpdatedBy(principal.id());
            policy.setUpdatedAt(Instant.now());
            changed.add(fieldPolicyRepository.save(policy));
        }

        List<FieldPolicy> refreshed = fieldPolicyRepository.findAll();
        auditService.record(principal.id(), "POLICY_FIELDS_UPDATED", "field_policy", null,
                before, snapshot(refreshed));
        policyMap.reload();
        return refreshed.stream().map(this::policyMap).toList();
    }

    @GetMapping("/users/{userId}")
    @PreAuthorize("hasAuthority('policy:manage')")
    public List<Map<String, Object>> userOverrides(@PathVariable UUID userId) {
        requireUser(userId);
        return overrideRepository.findByUserIdOrderByResourceAscFieldAsc(userId)
                .stream().map(this::overrideMap).toList();
    }

    @PutMapping("/users/{userId}")
    @PreAuthorize("hasAuthority('policy:manage')")
    @Transactional
    public List<Map<String, Object>> updateUserOverrides(@PathVariable UUID userId,
                                                        @RequestBody OverrideUpdate request,
                                                        @AuthenticationPrincipal AuthPrincipal principal) {
        requireUser(userId);
        if (request == null || request.overrides() == null) {
            throw ApiException.badRequest("NO_OVERRIDES", "overrides is required");
        }
        Map<String, UserPolicyOverride> existing = new HashMap<>();
        for (UserPolicyOverride override : overrideRepository.findByUserIdOrderByResourceAscFieldAsc(userId)) {
            existing.put(overrideKey(override.getResource(), override.getField(), override.getUnlockState()),
                    override);
        }
        List<Map<String, Object>> before = overrideRepository
                .findByUserIdOrderByResourceAscFieldAsc(userId).stream().map(this::overrideMap).toList();

        for (OverrideItem item : request.overrides()) {
            String resource = require(item.resource(), "resource");
            String field = require(item.field(), "field");
            Access access = parseAccess(item.access());
            UnlockState state = parseState(item.unlockState());
            UserPolicyOverride override = existing.get(overrideKey(resource, field, state));
            if (override == null) {
                override = new UserPolicyOverride();
                override.setUserId(userId);
                override.setResource(resource);
                override.setField(field);
                override.setUnlockState(state);
            }
            override.setAccess(access);
            override.setExpiresAt(item.expiresAt());
            override.setUpdatedBy(principal.id());
            override.setUpdatedAt(Instant.now());
            overrideRepository.save(override);
        }

        policyMap.reload();
        List<Map<String, Object>> after = overrideRepository
                .findByUserIdOrderByResourceAscFieldAsc(userId).stream().map(this::overrideMap).toList();
        auditService.record(principal.id(), "POLICY_OVERRIDES_UPDATED", "user", userId, before, after);
        return after;
    }

    @DeleteMapping("/users/{userId}/{overrideId}")
    @PreAuthorize("hasAuthority('policy:manage')")
    @Transactional
    public void deleteUserOverride(@PathVariable UUID userId, @PathVariable UUID overrideId,
                                   @AuthenticationPrincipal AuthPrincipal principal) {
        UserPolicyOverride override = overrideRepository.findById(overrideId)
                .filter(item -> item.getUserId().equals(userId))
                .orElseThrow(() -> ApiException.notFound("OVERRIDE_NOT_FOUND", "Override not found"));
        Map<String, Object> before = overrideMap(override);
        overrideRepository.delete(override);
        policyMap.reload();
        auditService.record(principal.id(), "POLICY_OVERRIDE_DELETED", "user", userId, before, null);
    }

    @GetMapping("/preview")
    @PreAuthorize("hasAuthority('policy:manage')")
    public Map<String, Object> preview(@RequestParam String role,
                                       @RequestParam(required = false) UUID userId,
                                       @RequestParam(required = false) UUID businessId,
                                       @RequestParam(required = false) String state) {
        Role parsedRole = parseRole(role);
        UnlockState unlockState;
        if (state != null && !state.isBlank()) {
            unlockState = parseState(state);
        } else {
            unlockState = parsedRole == Role.RESEARCHER ? UnlockState.LOCKED : UnlockState.ANY;
        }
        if (userId != null) {
            requireUser(userId);
        }

        Set<String> fields = new LinkedHashSet<>(policyMap.fieldsFor(parsedRole, "business", unlockState).keySet());
        if (userId != null) {
            overrideRepository.findByUserIdOrderByResourceAscFieldAsc(userId).stream()
                    .filter(item -> item.getResource().equals("business"))
                    .filter(item -> item.getExpiresAt() == null || item.getExpiresAt().isAfter(Instant.now()))
                    .forEach(item -> fields.add(item.getField()));
        }

        Map<String, Access> effective = new LinkedHashMap<>();
        fields.stream().sorted().forEach(field -> effective.put(field,
                policyEngine.effectiveAccess(parsedRole, userId, "business", field, unlockState)));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("role", parsedRole.apiValue());
        result.put("userId", userId);
        result.put("businessId", businessId);
        result.put("state", unlockState.name().toLowerCase(Locale.ROOT));
        result.put("fields", effective);
        return result;
    }

    private Map<String, Object> policyMap(FieldPolicy policy) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", policy.getId());
        map.put("role", policy.getRole().apiValue());
        map.put("resource", policy.getResource());
        map.put("field", policy.getField());
        map.put("access", policy.getAccess().name().toLowerCase(Locale.ROOT));
        map.put("unlockState", policy.getUnlockState().name().toLowerCase(Locale.ROOT));
        map.put("updatedAt", policy.getUpdatedAt());
        map.put("updatedBy", policy.getUpdatedBy());
        return map;
    }

    private Map<String, Object> overrideMap(UserPolicyOverride override) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", override.getId());
        map.put("userId", override.getUserId());
        map.put("resource", override.getResource());
        map.put("field", override.getField());
        map.put("access", override.getAccess().name().toLowerCase(Locale.ROOT));
        map.put("unlockState", override.getUnlockState().name().toLowerCase(Locale.ROOT));
        map.put("expiresAt", override.getExpiresAt());
        map.put("updatedAt", override.getUpdatedAt());
        return map;
    }

    private Map<String, String> snapshot(List<FieldPolicy> policies) {
        Map<String, String> snapshot = new LinkedHashMap<>();
        policies.stream()
                .sorted(Comparator.comparing((FieldPolicy p) -> p.getRole().name())
                        .thenComparing(FieldPolicy::getResource)
                        .thenComparing(FieldPolicy::getField)
                        .thenComparing(p -> p.getUnlockState().name()))
                .forEach(policy -> snapshot.put(key(policy.getRole(), policy.getResource(),
                                policy.getField(), policy.getUnlockState()),
                        policy.getAccess().name()));
        return snapshot;
    }

    private String key(Role role, String resource, String field, UnlockState state) {
        return role.name() + "|" + resource + "|" + field + "|" + state.name();
    }

    private String overrideKey(String resource, String field, UnlockState state) {
        return resource + "|" + field + "|" + state.name();
    }

    private String require(String value, String name) {
        if (value == null || value.isBlank()) {
            throw ApiException.badRequest("INVALID_POLICY", name + " is required");
        }
        return value;
    }

    private Role parseRole(String value) {
        try {
            return Role.from(value);
        } catch (IllegalArgumentException ex) {
            throw ApiException.badRequest("INVALID_ROLE", ex.getMessage());
        }
    }

    private Access parseAccess(String value) {
        try {
            return Access.valueOf(require(value, "access").toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw ApiException.badRequest("INVALID_ACCESS", "access must be hidden, masked, read or write");
        }
    }

    private UnlockState parseState(String value) {
        if (value == null || value.isBlank()) {
            return UnlockState.ANY;
        }
        try {
            return UnlockState.valueOf(value.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw ApiException.badRequest("INVALID_STATE", "unlockState must be any, locked or unlocked");
        }
    }

    private void requireUser(UUID userId) {
        if (!userRepository.existsById(userId)) {
            throw ApiException.notFound("USER_NOT_FOUND", "User not found");
        }
    }
}
