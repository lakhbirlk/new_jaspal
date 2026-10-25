package com.example.directory.user;

import com.example.directory.audit.AuditService;
import com.example.directory.auth.AuthPrincipal;
import com.example.directory.auth.AuthService;
import com.example.directory.auth.EmailToken;
import com.example.directory.auth.EmailTokenService;
import com.example.directory.auth.EmailService;
import com.example.directory.auth.RefreshTokenRepository;
import com.example.directory.business.Business;
import com.example.directory.business.BusinessRepository;
import com.example.directory.business.VerificationStatus;
import com.example.directory.common.ApiException;
import com.example.directory.common.CryptoService;
import com.example.directory.common.PageResult;
import com.example.directory.config.AppProperties;
import com.example.directory.document.DocumentRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final ResearcherProfileRepository profileRepository;
    private final BusinessRepository businessRepository;
    private final DocumentRepository documentRepository;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenRepository refreshTokenRepository;
    private final EmailTokenService emailTokenService;
    private final EmailService emailService;
    private final AuthService authService;
    private final AuditService auditService;
    private final CryptoService cryptoService;
    private final AppProperties properties;

    public record UpdateUser(String fullName, String email, String role, String status,
                             String reviewNote) {
    }

    public PageResult<Map<String, Object>> list(String roleValue, String statusValue, String q,
                                                 int page, int size) {
        Role role = roleValue == null || roleValue.isBlank() ? null : parseRole(roleValue);
        UserStatus status = statusValue == null || statusValue.isBlank() ? null : parseStatus(statusValue);
        String query = q == null ? null : q.trim().toLowerCase(Locale.ROOT);

        Specification<User> specification = (root, criteriaQuery, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (role != null) predicates.add(cb.equal(root.get("role"), role));
            if (status != null) predicates.add(cb.equal(root.get("status"), status));
            if (query != null && !query.isEmpty()) {
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("email")), "%" + query + "%"),
                        cb.like(cb.lower(root.get("fullName")), "%" + query + "%")));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        var result = userRepository.findAll(specification,
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                        Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResult.of(result, this::listMap);
    }

    public Map<String, Object> detail(UUID userId) {
        User user = requireUser(userId);
        Map<String, Object> result = baseMap(user);
        profileRepository.findById(userId).ifPresent(profile -> {
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("organization", profile.getOrganization());
            data.put("designation", profile.getDesignation());
            data.put("phone", profile.getPhone());
            data.put("purposeOfResearch", profile.getPurposeOfResearch());
            result.put("researcherProfile", data);
        });
        businessRepository.findByOwnerUserId(userId).ifPresent(business ->
                result.put("business", adminBusinessMap(business)));
        result.put("documents", documentRepository.findSummariesByOwner(userId));
        return result;
    }

    @Transactional
    public Map<String, Object> update(UUID userId, UpdateUser request, AuthPrincipal actor) {
        User user = requireUser(userId);
        Map<String, Object> before = baseMap(user);

        Role newRole = user.getRole();
        UserStatus newStatus = user.getStatus();
        if (request.role() != null && !request.role().isBlank()) {
            newRole = parseRole(request.role());
        }
        if (request.status() != null && !request.status().isBlank()) {
            newStatus = parseStatus(request.status());
        }

        if (actor.id().equals(userId)) {
            if (newRole != user.getRole()) {
                throw ApiException.badRequest("SELF_ACCESS", "You cannot change your own role");
            }
            if (newStatus != UserStatus.ACTIVE) {
                throw ApiException.badRequest("SELF_ACCESS", "You cannot deactivate your own account");
            }
        }

        boolean wasActiveAdmin = user.getRole() == Role.ADMIN && user.getStatus() == UserStatus.ACTIVE;
        boolean willRemainActiveAdmin = newRole == Role.ADMIN && newStatus == UserStatus.ACTIVE;
        if (wasActiveAdmin && !willRemainActiveAdmin && activeAdminCount() <= 1) {
            throw ApiException.badRequest("LAST_ADMIN", "The last active admin cannot be removed");
        }

        if (request.email() != null && !request.email().isBlank()) {
            String email = request.email().trim().toLowerCase(Locale.ROOT);
            userRepository.findByEmailIgnoreCase(email).ifPresent(existing -> {
                if (!existing.getId().equals(userId)) {
                    throw ApiException.conflict("EMAIL_IN_USE", "That email is already in use");
                }
            });
            user.setEmail(email);
        }
        if (request.fullName() != null && !request.fullName().isBlank()) {
            user.setFullName(request.fullName().trim());
        }
        if (newStatus == UserStatus.REJECTED && (request.reviewNote() == null
                || request.reviewNote().isBlank())) {
            throw ApiException.badRequest("REASON_REQUIRED", "A review note is required when rejecting");
        }
        if (request.reviewNote() != null) {
            user.setReviewNote(request.reviewNote().isBlank() ? null : request.reviewNote().trim());
        }

        if (newRole != user.getRole()) {
            user.setTokenVersion(user.getTokenVersion() + 1);
        }
        if (newStatus != user.getStatus()) {
            if (newStatus == UserStatus.SUSPENDED) {
                user.setTokenVersion(user.getTokenVersion() + 1);
                refreshTokenRepository.revokeAllForUser(user.getId(), Instant.now());
            }
            if (newStatus == UserStatus.ACTIVE && user.getEmailVerifiedAt() == null) {
                user.setEmailVerifiedAt(Instant.now());
            }
            if ((newStatus == UserStatus.PENDING_PROFILE || newStatus == UserStatus.PENDING_REVIEW)
                    && user.getEmailVerifiedAt() == null) {
                user.setEmailVerifiedAt(Instant.now());
            }
        }
        user.setRole(newRole);
        user.setStatus(newStatus);
        userRepository.save(user);

        Map<String, Object> after = baseMap(user);
        auditService.record(actor.id(), "USER_UPDATED", "user", userId, before, after);
        return detail(userId);
    }

    @Transactional
    public Map<String, Object> approve(UUID userId, AuthPrincipal actor) {
        User user = requireUser(userId);
        if (user.getStatus() != UserStatus.PENDING_REVIEW) {
            throw ApiException.conflict("NOT_IN_REVIEW", "Only profiles that were submitted can be approved");
        }
        Map<String, Object> before = baseMap(user);
        user.setStatus(UserStatus.ACTIVE);
        user.setReviewNote(null);
        user.setEmailVerifiedAt(user.getEmailVerifiedAt() == null ? Instant.now() : user.getEmailVerifiedAt());
        userRepository.save(user);
        businessRepository.findByOwnerUserId(userId).ifPresent(business -> {
            business.setVerificationStatus(VerificationStatus.VERIFIED);
            businessRepository.save(business);
        });
        auditService.record(actor.id(), "USER_APPROVED", "user", userId, before, baseMap(user));
        return detail(userId);
    }

    @Transactional
    public Map<String, Object> reject(UUID userId, String reason, AuthPrincipal actor) {
        User user = requireUser(userId);
        if (user.getStatus() != UserStatus.PENDING_REVIEW) {
            throw ApiException.conflict("NOT_IN_REVIEW", "Only profiles that were submitted can be rejected");
        }
        if (reason == null || reason.isBlank()) {
            throw ApiException.badRequest("REASON_REQUIRED", "A rejection reason is required");
        }
        Map<String, Object> before = baseMap(user);
        user.setStatus(UserStatus.PENDING_PROFILE);
        user.setReviewNote(reason.trim());
        user.setSubmittedAt(null);
        userRepository.save(user);
        auditService.record(actor.id(), "USER_REJECTED", "user", userId, before, baseMap(user));
        return detail(userId);
    }

    @Transactional
    public Map<String, Object> invite(String email, String fullName, String roleValue,
                                      AuthPrincipal actor) {
        Role role = parseRole(roleValue);
        if (role != Role.ADMIN && role != Role.AUDITOR) {
            throw ApiException.badRequest("INVALID_ROLE", "Only admin and auditor accounts are invited");
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (userRepository.existsByEmailIgnoreCase(normalized)) {
            throw ApiException.conflict("EMAIL_IN_USE", "An account with this email already exists");
        }
        User user = new User();
        user.setEmail(normalized);
        user.setFullName(fullName.trim());
        user.setRole(role);
        user.setStatus(UserStatus.PENDING_EMAIL);
        user.setPasswordHash(passwordEncoder.encode("unusable-" + UUID.randomUUID()));
        user.setMfaEnabled(false);
        user = userRepository.save(user);

        String token = authService.createInviteToken(user);
        auditService.record(actor.id(), "USER_INVITED", "user", user.getId(), null,
                Map.of("role", role.name(), "email", normalized));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", user.getId());
        response.put("email", user.getEmail());
        response.put("role", role.apiValue());
        response.put("status", user.getStatus().apiValue());
        if (properties.getDev().isExposeEmailTokens()) {
            response.put("devInviteToken", token);
        }
        return response;
    }

    @Transactional
    public Map<String, Object> forcePasswordReset(UUID userId, AuthPrincipal actor) {
        User user = requireUser(userId);
        String token = emailTokenService.create(user.getId(), EmailToken.Purpose.RESET, 24);
        emailService.sendPasswordReset(user.getEmail(), token);
        auditService.record(actor.id(), "PASSWORD_RESET_FORCED", "user", userId, null, null);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "A password reset link has been issued");
        if (properties.getDev().isExposeEmailTokens()) {
            response.put("devResetToken", token);
        }
        return response;
    }

    @Transactional
    public void resetMfa(UUID userId, AuthPrincipal actor) {
        User user = requireUser(userId);
        Map<String, Object> before = Map.of("mfaEnabled", user.isMfaEnabled());
        user.setMfaEnabled(false);
        user.setMfaSecret(null);
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);
        refreshTokenRepository.revokeAllForUser(userId, Instant.now());
        auditService.record(actor.id(), "MFA_RESET", "user", userId, before,
                Map.of("mfaEnabled", false));
    }

    @Transactional
    public Map<String, Object> setSuspended(UUID userId, boolean suspended, AuthPrincipal actor) {
        User user = requireUser(userId);
        if (actor.id().equals(userId)) {
            throw ApiException.badRequest("SELF_ACCESS", "You cannot suspend your own account");
        }
        if (suspended && user.getRole() == Role.ADMIN && activeAdminCount() <= 1) {
            throw ApiException.badRequest("LAST_ADMIN", "The last active admin cannot be suspended");
        }
        Map<String, Object> before = baseMap(user);
        user.setStatus(suspended ? UserStatus.SUSPENDED : UserStatus.ACTIVE);
        if (suspended) {
            user.setTokenVersion(user.getTokenVersion() + 1);
            refreshTokenRepository.revokeAllForUser(userId, Instant.now());
        }
        userRepository.save(user);
        auditService.record(actor.id(), suspended ? "USER_SUSPENDED" : "USER_ACTIVATED",
                "user", userId, before, baseMap(user));
        return detail(userId);
    }

    private Map<String, Object> listMap(User user) {
        Map<String, Object> map = baseMap(user);
        if (user.getRole() == Role.BUSINESS) {
            businessRepository.findByOwnerUserId(user.getId()).ifPresent(business ->
                    map.put("businessName", business.getLegalName()));
        } else if (user.getRole() == Role.RESEARCHER) {
            profileRepository.findById(user.getId()).ifPresent(profile ->
                    map.put("organization", profile.getOrganization()));
        }
        return map;
    }

    private Map<String, Object> baseMap(User user) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", user.getId());
        map.put("email", user.getEmail());
        map.put("fullName", user.getFullName());
        map.put("role", user.getRole().apiValue());
        map.put("status", user.getStatus().apiValue());
        map.put("emailVerified", user.getEmailVerifiedAt() != null);
        map.put("mfaEnabled", user.isMfaEnabled());
        map.put("reviewNote", user.getReviewNote());
        map.put("submittedAt", user.getSubmittedAt());
        map.put("createdAt", user.getCreatedAt());
        map.put("updatedAt", user.getUpdatedAt());
        return map;
    }

    private Map<String, Object> adminBusinessMap(Business business) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", business.getId());
        map.put("legalName", business.getLegalName());
        map.put("tradeName", business.getTradeName());
        map.put("registrationNumber", business.getRegistrationNumber());
        map.put("taxId", cryptoService.decrypt(business.getTaxId()));
        map.put("industry", business.getIndustry());
        map.put("category", business.getCategory());
        map.put("addressLine", business.getAddressLine());
        map.put("city", business.getCity());
        map.put("state", business.getState());
        map.put("country", business.getCountry());
        map.put("postalCode", business.getPostalCode());
        map.put("website", business.getWebsite());
        map.put("publicEmail", business.getPublicEmail());
        map.put("publicPhone", business.getPublicPhone());
        map.put("contactPersonName", business.getContactPersonName());
        map.put("contactPersonPhone", business.getContactPersonPhone());
        map.put("annualRevenue", business.getAnnualRevenue());
        map.put("employeeCount", business.getEmployeeCount());
        map.put("bankDetails", cryptoService.decrypt(business.getBankDetails()));
        map.put("description", business.getDescription());
        map.put("verificationStatus", business.getVerificationStatus().name().toLowerCase(Locale.ROOT));
        map.put("adminListingStatus", business.getAdminListingStatus().name().toLowerCase(Locale.ROOT));
        map.put("listedUntil", business.getListedUntil());
        return map;
    }

    private long activeAdminCount() {
        return userRepository.countByRoleAndStatus(Role.ADMIN, UserStatus.ACTIVE);
    }

    private User requireUser(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "User not found"));
    }

    private Role parseRole(String value) {
        try {
            return Role.from(value);
        } catch (IllegalArgumentException ex) {
            throw ApiException.badRequest("INVALID_ROLE", ex.getMessage());
        }
    }

    private UserStatus parseStatus(String value) {
        try {
            return UserStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            throw ApiException.badRequest("INVALID_STATUS", "Unknown user status");
        }
    }
}
