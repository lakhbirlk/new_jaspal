package com.example.directory.user;

import com.example.directory.audit.AuditService;
import com.example.directory.auth.AuthPrincipal;
import com.example.directory.common.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class RolePermissionAdminController {

    private final PermissionRepository permissionRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final AuditService auditService;

    public record PermissionsUpdate(List<String> permissions) {
    }

    @GetMapping("/permissions")
    @PreAuthorize("hasAuthority('policy:manage')")
    public List<Map<String, Object>> permissions() {
        return permissionRepository.findAllByOrderByCodeAsc().stream()
                .map(permission -> Map.<String, Object>of(
                        "id", permission.getId(), "code", permission.getCode()))
                .toList();
    }

    @GetMapping("/roles/{role}/permissions")
    @PreAuthorize("hasAuthority('policy:manage')")
    public Map<String, Object> rolePermissions(@PathVariable String role) {
        Role parsed = parseRole(role);
        List<String> codes = rolePermissionRepository.findPermissionCodes(parsed);
        return Map.of("role", parsed.apiValue(), "permissions", codes);
    }

    @PutMapping("/roles/{role}/permissions")
    @PreAuthorize("hasAuthority('policy:manage')")
    @Transactional
    public Map<String, Object> updateRolePermissions(@PathVariable String role,
                                                     @RequestBody PermissionsUpdate request,
                                                     @AuthenticationPrincipal AuthPrincipal principal) {
        Role parsed = parseRole(role);
        if (request == null || request.permissions() == null) {
            throw ApiException.badRequest("INVALID_PERMISSIONS", "permissions is required");
        }
        Set<String> requested = new LinkedHashSet<>(request.permissions());

        if (parsed == Role.ADMIN) {
            Set<String> critical = Set.of("user:update", "policy:manage", "audit:read");
            if (!requested.containsAll(critical)) {
                throw ApiException.badRequest("LAST_ADMIN_SAFETY",
                        "The admin role must retain user:update, policy:manage and audit:read");
            }
        }

        List<String> before = rolePermissionRepository.findPermissionCodes(parsed);
        rolePermissionRepository.deleteByRole(parsed);
        for (String code : requested) {
            Permission permission = permissionRepository.findByCode(code)
                    .orElseThrow(() -> ApiException.badRequest("UNKNOWN_PERMISSION",
                            "Unknown permission: " + code));
            RolePermission rolePermission = new RolePermission();
            rolePermission.setRole(parsed);
            rolePermission.setPermission(permission);
            rolePermissionRepository.save(rolePermission);
        }
        List<String> after = rolePermissionRepository.findPermissionCodes(parsed);
        auditService.record(principal.id(), "ROLE_PERMISSIONS_UPDATED", "role", null,
                Map.of("role", parsed.name(), "permissions", before),
                Map.of("role", parsed.name(), "permissions", after));
        return Map.of("role", parsed.apiValue(), "permissions", after);
    }

    private Role parseRole(String value) {
        try {
            return Role.from(value);
        } catch (IllegalArgumentException ex) {
            throw ApiException.badRequest("INVALID_ROLE", ex.getMessage());
        }
    }
}
