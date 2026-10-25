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
public class AdminSettingsController {

    private final AppSettingService appSettingService;
    private final ProfileRequirementRepository requirementRepository;
    private final AuditService auditService;

    public record RequirementItem(String role, String kind, String name, Boolean required) {
    }

    public record RequirementUpdate(List<RequirementItem> requirements) {
    }

    @GetMapping("/settings")
    @PreAuthorize("hasAuthority('user:update')")
    public Map<String, String> settings() {
        return appSettingService.all();
    }

    @PutMapping("/settings")
    @PreAuthorize("hasAuthority('user:update')")
    @Transactional
    public Map<String, String> updateSettings(@RequestBody Map<String, String> values,
                                              @AuthenticationPrincipal AuthPrincipal principal) {
        if (values == null || values.isEmpty()) {
            throw ApiException.badRequest("NO_SETTINGS", "At least one setting is required");
        }
        Map<String, String> before = appSettingService.all();
        appSettingService.put(values);
        Map<String, String> after = appSettingService.all();
        auditService.record(principal.id(), "SETTINGS_UPDATED", "settings", null, before, after);
        return after;
    }

    @GetMapping("/profile-requirements")
    @PreAuthorize("hasAuthority('user:update')")
    public List<Map<String, Object>> requirements(@RequestParam(required = false) String role) {
        List<ProfileRequirement> requirements;
        if (role == null || role.isBlank()) {
            requirements = requirementRepository.findAll();
        } else {
            requirements = requirementRepository.findByRoleOrderByKindAscNameAsc(parseRole(role));
        }
        return requirements.stream().map(this::map).toList();
    }

    @PutMapping("/profile-requirements")
    @PreAuthorize("hasAuthority('user:update')")
    @Transactional
    public List<Map<String, Object>> updateRequirements(@RequestBody RequirementUpdate request,
                                                       @AuthenticationPrincipal AuthPrincipal principal) {
        if (request == null || request.requirements() == null) {
            throw ApiException.badRequest("NO_REQUIREMENTS", "requirements is required");
        }
        List<Map<String, Object>> before = requirementRepository.findAll().stream().map(this::map).toList();

        for (RequirementItem item : request.requirements()) {
            Role role = parseRole(item.role());
            ProfileRequirement.Kind kind;
            try {
                kind = ProfileRequirement.Kind.valueOf(item.kind().toUpperCase(Locale.ROOT));
            } catch (Exception ex) {
                throw ApiException.badRequest("INVALID_KIND", "kind must be field or document");
            }
            if (item.name() == null || item.name().isBlank()) {
                throw ApiException.badRequest("INVALID_NAME", "name is required");
            }
            ProfileRequirement requirement = requirementRepository
                    .findByRoleOrderByKindAscNameAsc(role).stream()
                    .filter(existing -> existing.getKind() == kind && existing.getName().equals(item.name()))
                    .findFirst()
                    .orElseGet(() -> {
                        ProfileRequirement created = new ProfileRequirement();
                        created.setRole(role);
                        created.setKind(kind);
                        created.setName(item.name());
                        return created;
                    });
            requirement.setRequired(item.required() == null || item.required());
            requirementRepository.save(requirement);
        }

        List<Map<String, Object>> after = requirementRepository.findAll().stream().map(this::map).toList();
        auditService.record(principal.id(), "PROFILE_REQUIREMENTS_UPDATED", "settings", null, before, after);
        return after;
    }

    @DeleteMapping("/profile-requirements/{id}")
    @PreAuthorize("hasAuthority('user:update')")
    @Transactional
    public void deleteRequirement(@PathVariable UUID id, @AuthenticationPrincipal AuthPrincipal principal) {
        ProfileRequirement requirement = requirementRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("REQUIREMENT_NOT_FOUND", "Requirement not found"));
        Map<String, Object> before = map(requirement);
        requirementRepository.delete(requirement);
        auditService.record(principal.id(), "PROFILE_REQUIREMENT_DELETED", "settings", null, before, null);
    }

    private Map<String, Object> map(ProfileRequirement requirement) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", requirement.getId());
        map.put("role", requirement.getRole().apiValue());
        map.put("kind", requirement.getKind().name().toLowerCase(Locale.ROOT));
        map.put("name", requirement.getName());
        map.put("required", requirement.isRequired());
        return map;
    }

    private Role parseRole(String value) {
        try {
            return Role.from(value);
        } catch (IllegalArgumentException ex) {
            throw ApiException.badRequest("INVALID_ROLE", ex.getMessage());
        }
    }
}
