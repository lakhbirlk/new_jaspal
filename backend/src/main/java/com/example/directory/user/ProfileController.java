package com.example.directory.user;

import com.example.directory.audit.AuditService;
import com.example.directory.auth.AuthPrincipal;
import com.example.directory.auth.AuthService;
import com.example.directory.business.Business;
import com.example.directory.business.BusinessRepository;
import com.example.directory.common.ApiException;
import com.example.directory.policy.Access;
import com.example.directory.policy.PolicyEngine;
import com.example.directory.policy.UnlockState;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/v1/me")
@RequiredArgsConstructor
public class ProfileController {

    private final UserRepository userRepository;
    private final ResearcherProfileRepository profileRepository;
    private final BusinessRepository businessRepository;
    private final ProfileCompletionService completionService;
    private final PolicyEngine policyEngine;
    private final AuthService authService;
    private final AuditService auditService;

    public record ProfileUpdate(
            @Size(max = 200) String fullName,
            @Size(max = 200) String organization,
            @Size(max = 200) String designation,
            @Pattern(regexp = "^$|^[+0-9 ()-]{6,40}$", message = "Invalid phone number") String phone,
            @Size(max = 4000) String purposeOfResearch) {
    }

    @GetMapping
    @PreAuthorize("hasAuthority('profile:read')")
    public Map<String, Object> me(@AuthenticationPrincipal AuthPrincipal principal) {
        User user = requireUser(principal.id());
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("user", authService.userSummary(user));
        response.put("permissions", permissions());
        response.put("restricted", user.getStatus() != UserStatus.ACTIVE);

        Map<String, Map<String, Access>> fieldPolicies = new LinkedHashMap<>();
        if (user.getRole() == Role.RESEARCHER) {
            fieldPolicies.put("locked", policyEngine.accessMap(user.getRole(), user.getId(),
                    "business", UnlockState.LOCKED));
            fieldPolicies.put("unlocked", policyEngine.accessMap(user.getRole(), user.getId(),
                    "business", UnlockState.UNLOCKED));
        } else {
            fieldPolicies.put("any", policyEngine.accessMap(user.getRole(), user.getId(),
                    "business", UnlockState.ANY));
        }
        response.put("fieldPolicies", fieldPolicies);

        businessRepository.findByOwnerUserId(user.getId()).ifPresent(business ->
                response.put("businessId", business.getId()));
        if (user.getRole() == Role.RESEARCHER || user.getRole() == Role.BUSINESS) {
            response.put("profileCompletion", completionService.completion(user));
        }
        return response;
    }

    @GetMapping("/status")
    @PreAuthorize("hasAuthority('status:read')")
    public Map<String, Object> status(@AuthenticationPrincipal AuthPrincipal principal) {
        User user = requireUser(principal.id());
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", user.getStatus().apiValue());
        response.put("restricted", user.getStatus() != UserStatus.ACTIVE);
        response.put("reviewNote", user.getReviewNote());
        response.put("submittedAt", user.getSubmittedAt());
        if (user.getRole() == Role.RESEARCHER || user.getRole() == Role.BUSINESS) {
            response.put("profileCompletion", completionService.completion(user));
        }
        return response;
    }

    @GetMapping("/profile/completion")
    @PreAuthorize("hasAuthority('profile:read')")
    public Map<String, Object> completion(@AuthenticationPrincipal AuthPrincipal principal) {
        return completionService.completion(requireUser(principal.id()));
    }

    @GetMapping("/profile")
    @PreAuthorize("hasAuthority('profile:read')")
    public Map<String, Object> profile(@AuthenticationPrincipal AuthPrincipal principal) {
        User user = requireUser(principal.id());
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("user", authService.userSummary(user));
        if (user.getRole() == Role.RESEARCHER) {
            response.put("profile", profileMap(profileRepository.findById(user.getId())
                    .orElseThrow(() -> ApiException.notFound("PROFILE_NOT_FOUND", "Profile not found"))));
        } else if (user.getRole() == Role.BUSINESS) {
            Business business = businessRepository.findByOwnerUserId(user.getId())
                    .orElseThrow(() -> ApiException.notFound("BUSINESS_NOT_FOUND", "Business not found"));
            response.put("businessId", business.getId());
            response.put("message", "Edit your business details through /my/business");
        }
        response.put("completion", completionService.completion(user));
        return response;
    }

    @PatchMapping("/profile")
    @PreAuthorize("hasAuthority('profile:edit')")
    @Transactional
    public Map<String, Object> updateProfile(@Valid @RequestBody ProfileUpdate request,
                                             @AuthenticationPrincipal AuthPrincipal principal) {
        User user = requireUser(principal.id());
        if (user.getRole() != Role.RESEARCHER) {
            throw ApiException.badRequest("WRONG_ENDPOINT",
                    "Business users edit their profile through /my/business");
        }
        assertEditable(user);
        ResearcherProfile profile = profileRepository.findById(user.getId())
                .orElseGet(() -> {
                    ResearcherProfile created = new ResearcherProfile();
                    created.setUserId(user.getId());
                    return created;
                });
        Map<String, Object> before = profileMap(profile);

        if (request.fullName() != null) {
            if (request.fullName().isBlank()) {
                throw ApiException.badRequest("INVALID_NAME", "Full name cannot be blank");
            }
            profile.setFullName(request.fullName().trim());
            user.setFullName(request.fullName().trim());
            userRepository.save(user);
        }
        if (request.organization() != null) profile.setOrganization(trim(request.organization()));
        if (request.designation() != null) profile.setDesignation(trim(request.designation()));
        if (request.phone() != null) profile.setPhone(trim(request.phone()));
        if (request.purposeOfResearch() != null) profile.setPurposeOfResearch(trim(request.purposeOfResearch()));
        profileRepository.save(profile);

        Map<String, Object> after = profileMap(profile);
        auditService.record(user.getId(), "PROFILE_UPDATED", "user", user.getId(), before, after);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("profile", after);
        response.put("completion", completionService.completion(user));
        return response;
    }

    @PostMapping("/submit-for-review")
    @PreAuthorize("hasAuthority('profile:read')")
    @Transactional
    public Map<String, Object> submitForReview(@AuthenticationPrincipal AuthPrincipal principal) {
        User user = requireUser(principal.id());
        if (user.getRole() != Role.RESEARCHER && user.getRole() != Role.BUSINESS) {
            throw ApiException.badRequest("INVALID_ROLE", "This role does not submit a profile");
        }
        if (user.getStatus() == UserStatus.PENDING_REVIEW) {
            throw ApiException.conflict("ALREADY_UNDER_REVIEW", "Your profile is already under review");
        }
        if (user.getStatus() == UserStatus.ACTIVE) {
            throw ApiException.conflict("ALREADY_APPROVED", "Your profile is already approved");
        }
        if (user.getStatus() == UserStatus.SUSPENDED || user.getStatus() == UserStatus.PENDING_EMAIL) {
            throw ApiException.conflict("PROFILE_NOT_EDITABLE", "Your account cannot submit a profile now");
        }
        Map<String, Object> completion = completionService.completion(user);
        if (!Boolean.TRUE.equals(completion.get("complete"))) {
            throw ApiException.unprocessable("PROFILE_INCOMPLETE",
                    "Complete all required fields and documents before submitting",
                    completion.get("missing"));
        }
        user.setStatus(UserStatus.PENDING_REVIEW);
        user.setSubmittedAt(Instant.now());
        user.setReviewNote(null);
        userRepository.save(user);
        auditService.record(user.getId(), "PROFILE_SUBMITTED", "user", user.getId(),
                Map.of("status", "PENDING_PROFILE"), Map.of("status", "PENDING_REVIEW"));
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", user.getStatus().apiValue());
        response.put("message", "Your profile was submitted for review");
        response.put("completion", completionService.completion(user));
        return response;
    }

    private void assertEditable(User user) {
        if (user.getStatus() == UserStatus.PENDING_REVIEW) {
            throw ApiException.conflict("PROFILE_UNDER_REVIEW",
                    "Your profile is under review and cannot be edited");
        }
        if (user.getStatus() == UserStatus.SUSPENDED) {
            throw ApiException.forbidden("ACCOUNT_SUSPENDED", "This account is suspended");
        }
        if (user.getStatus() == UserStatus.PENDING_EMAIL) {
            throw ApiException.forbidden("EMAIL_NOT_VERIFIED", "Verify your email first");
        }
    }

    private Map<String, Object> profileMap(ResearcherProfile profile) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("fullName", profile.getFullName());
        map.put("organization", profile.getOrganization());
        map.put("designation", profile.getDesignation());
        map.put("phone", profile.getPhone());
        map.put("purposeOfResearch", profile.getPurposeOfResearch());
        return map;
    }

    private List<String> permissions() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) return List.of();
        return authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .filter(authority -> !authority.startsWith("ROLE_"))
                .sorted()
                .toList();
    }

    private String trim(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private User requireUser(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "User not found"));
    }
}
