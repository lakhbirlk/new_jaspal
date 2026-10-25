package com.example.directory.auth;

import com.example.directory.audit.AuditService;
import com.example.directory.business.AdminListingStatus;
import com.example.directory.business.Business;
import com.example.directory.business.BusinessRepository;
import com.example.directory.business.VerificationStatus;
import com.example.directory.common.ApiException;
import com.example.directory.common.CryptoService;
import com.example.directory.config.AppProperties;
import com.example.directory.user.*;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final String MFA_CHALLENGE = "mfa";
    private static final String MFA_SETUP = "mfa_setup";

    private final UserRepository userRepository;
    private final ResearcherProfileRepository profileRepository;
    private final BusinessRepository businessRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordPolicy passwordPolicy;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final RefreshTokenRepository refreshTokenRepository;
    private final EmailTokenService emailTokenService;
    private final EmailService emailService;
    private final CryptoService cryptoService;
    private final TotpService totpService;
    private final AppSettingService settingService;
    private final AuditService auditService;
    private final AppProperties properties;

    private volatile String dummyHash;

    @Transactional
    public Map<String, Object> register(AuthRequests.Register request) {
        Role role;
        try {
            role = Role.from(request.role());
        } catch (IllegalArgumentException ex) {
            throw ApiException.badRequest("INVALID_ROLE", "Only researcher and business can register");
        }
        if (role != Role.RESEARCHER && role != Role.BUSINESS) {
            throw ApiException.badRequest("INVALID_ROLE", "Only researcher and business can register");
        }
        String email = normalizeEmail(request.email());
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("EMAIL_IN_USE", "An account with this email already exists");
        }
        passwordPolicy.validate(request.password());

        User user = new User();
        user.setEmail(email);
        user.setFullName(request.fullName().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(role);
        user.setStatus(UserStatus.PENDING_EMAIL);
        user.setMfaEnabled(false);
        user = userRepository.save(user);

        if (role == Role.RESEARCHER) {
            ResearcherProfile profile = new ResearcherProfile();
            profile.setUserId(user.getId());
            profile.setFullName(user.getFullName());
            profileRepository.save(profile);
        } else {
            if (request.businessName() == null || request.businessName().isBlank()) {
                throw ApiException.badRequest("BUSINESS_NAME_REQUIRED", "Business name is required");
            }
            Business business = new Business();
            business.setOwnerUserId(user.getId());
            business.setLegalName(request.businessName().trim());
            business.setVerificationStatus(VerificationStatus.UNVERIFIED);
            business.setAdminListingStatus(AdminListingStatus.UNLISTED);
            businessRepository.save(business);
        }

        String token = emailTokenService.create(user.getId(), EmailToken.Purpose.VERIFY, 24);
        emailService.sendVerification(email, token);
        auditService.record(user.getId(), "USER_REGISTERED", "user", user.getId(), null,
                Map.of("role", role.name(), "status", user.getStatus().name(), "email", email));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("userId", user.getId());
        response.put("status", user.getStatus().apiValue());
        response.put("message", "Check your email to verify your account");
        if (properties.getDev().isExposeEmailTokens()) {
            response.put("devVerificationToken", token);
        }
        return response;
    }

    @Transactional
    public Map<String, Object> verifyEmail(String rawToken) {
        EmailToken token = emailTokenService.consume(rawToken, EmailToken.Purpose.VERIFY);
        User user = requireUser(token.getUserId());
        user.setEmailVerifiedAt(Instant.now());
        if (user.getStatus() == UserStatus.PENDING_EMAIL) {
            user.setStatus(UserStatus.PENDING_PROFILE);
        }
        userRepository.save(user);
        auditService.record(user.getId(), "EMAIL_VERIFIED", "user", user.getId(), null,
                Map.of("status", user.getStatus().name()));
        return Map.of("status", user.getStatus().apiValue(),
                "message", "Email verified. You can now complete your profile.");
    }

    public Map<String, Object> login(AuthRequests.Login request) {
        String email = normalizeEmail(request.email());
        Optional<User> optional = userRepository.findByEmailIgnoreCase(email);
        if (optional.isEmpty()) {
            passwordEncoder.matches(request.password(), dummyHash());
            auditService.record("LOGIN_FAILED", "user", null, null,
                    Map.of("email", email, "reason", "UNKNOWN_EMAIL"));
            throw ApiException.unauthorized("INVALID_CREDENTIALS", "Email or password is incorrect");
        }

        User user = optional.get();
        if (user.isLocked()) {
            throw new ApiException(HttpStatus.LOCKED, "ACCOUNT_LOCKED",
                    "Account is temporarily locked. Try again later.",
                    Map.of("lockedUntil", user.getLockedUntil()));
        }

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            int maxFailures = Math.max(3, settingService.getInt("login.max.failures", 5));
            int lockMinutes = Math.max(1, settingService.getInt("login.lock.minutes", 15));
            user.setFailedLoginCount(user.getFailedLoginCount() + 1);
            boolean locked = user.getFailedLoginCount() >= maxFailures;
            if (locked) {
                user.setLockedUntil(Instant.now().plusSeconds(lockMinutes * 60L));
            }
            userRepository.save(user);
            auditService.record(user.getId(), "LOGIN_FAILED", "user", user.getId(), null,
                    Map.of("reason", "BAD_PASSWORD", "locked", locked));
            if (locked) {
                throw new ApiException(HttpStatus.LOCKED, "ACCOUNT_LOCKED",
                        "Too many failed attempts. Account locked for " + lockMinutes + " minutes.",
                        Map.of("lockedUntil", user.getLockedUntil()));
            }
            throw ApiException.unauthorized("INVALID_CREDENTIALS", "Email or password is incorrect");
        }

        user.setFailedLoginCount(0);
        user.setLockedUntil(null);
        userRepository.save(user);

        if (user.getStatus() == UserStatus.PENDING_EMAIL) {
            throw ApiException.forbidden("EMAIL_NOT_VERIFIED", "Verify your email before logging in");
        }
        if (user.getStatus() == UserStatus.SUSPENDED) {
            throw ApiException.forbidden("ACCOUNT_SUSPENDED", "This account is suspended");
        }

        if (requiredMfa(user) && !user.isMfaEnabled()) {
            auditService.record(user.getId(), "MFA_SETUP_REQUIRED", "user", user.getId(), null, null);
            Map<String, Object> response = baseUserResponse(user);
            response.put("status", "mfa_setup_required");
            response.put("enrollmentToken", jwtService.createPurposeToken(user.getId(), MFA_SETUP, 10));
            return response;
        }
        if (requiredMfa(user) && user.isMfaEnabled()) {
            auditService.record(user.getId(), "MFA_CHALLENGE_ISSUED", "user", user.getId(), null, null);
            Map<String, Object> response = baseUserResponse(user);
            response.put("status", "mfa_required");
            response.put("challengeToken", jwtService.createPurposeToken(user.getId(), MFA_CHALLENGE, 5));
            return response;
        }

        auditService.record(user.getId(), "LOGIN_SUCCESS", "user", user.getId(), null,
                Map.of("status", user.getStatus().name()));
        return authenticatedResponse(user);
    }

    @Transactional
    public Map<String, Object> mfaVerify(String challengeToken, String code) {
        UUID userId = userIdFromPurposeToken(challengeToken, MFA_CHALLENGE);
        User user = requireUser(userId);
        if (user.getStatus() == UserStatus.SUSPENDED || user.getStatus() == UserStatus.PENDING_EMAIL) {
            throw ApiException.forbidden("ACCOUNT_UNAVAILABLE", "This account cannot sign in");
        }
        if (!user.isMfaEnabled() || user.getMfaSecret() == null) {
            throw ApiException.badRequest("MFA_NOT_ENABLED", "MFA is not enabled for this account");
        }
        String secret = cryptoService.decrypt(user.getMfaSecret());
        if (!totpService.verify(secret, code)) {
            throw ApiException.unauthorized("INVALID_MFA_CODE", "The verification code is incorrect");
        }
        auditService.record(user.getId(), "LOGIN_SUCCESS", "user", user.getId(), null,
                Map.of("status", user.getStatus().name(), "mfa", true));
        return authenticatedResponse(user);
    }

    @Transactional
    public Map<String, Object> mfaSetup(String enrollmentToken, AuthPrincipal principal) {
        User user;
        if (enrollmentToken != null && !enrollmentToken.isBlank()) {
            user = requireUser(userIdFromPurposeToken(enrollmentToken, MFA_SETUP));
        } else if (principal != null) {
            user = requireUser(principal.id());
        } else {
            throw ApiException.unauthorized("ENROLLMENT_TOKEN_REQUIRED",
                    "An enrollment token or an authenticated session is required");
        }
        if (user.isMfaEnabled()) {
            throw ApiException.conflict("MFA_ALREADY_ENABLED", "MFA is already enabled");
        }
        if (user.getMfaSecret() == null) {
            String secret = totpService.generateSecret();
            user.setMfaSecret(cryptoService.encrypt(secret));
            userRepository.save(user);
            auditService.record(user.getId(), "MFA_SETUP_STARTED", "user", user.getId(), null, null);
        }
        String secret = cryptoService.decrypt(user.getMfaSecret());
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("secret", secret);
        response.put("otpauthUri", totpService.otpauthUri(user.getEmail(), secret));
        response.put("status", "mfa_setup_pending");
        if (enrollmentToken != null && !enrollmentToken.isBlank()) {
            response.put("enrollmentToken", enrollmentToken);
        }
        return response;
    }

    @Transactional
    public Map<String, Object> mfaEnable(String enrollmentToken, String code, AuthPrincipal principal) {
        User user;
        if (enrollmentToken != null && !enrollmentToken.isBlank()) {
            user = requireUser(userIdFromPurposeToken(enrollmentToken, MFA_SETUP));
        } else if (principal != null) {
            user = requireUser(principal.id());
        } else {
            throw ApiException.unauthorized("ENROLLMENT_TOKEN_REQUIRED",
                    "An enrollment token or an authenticated session is required");
        }
        if (user.getMfaSecret() == null) {
            throw ApiException.badRequest("MFA_SETUP_REQUIRED", "Start MFA setup first");
        }
        String secret = cryptoService.decrypt(user.getMfaSecret());
        if (!totpService.verify(secret, code)) {
            throw ApiException.unauthorized("INVALID_MFA_CODE", "The verification code is incorrect");
        }
        user.setMfaEnabled(true);
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);
        auditService.record(user.getId(), "MFA_ENABLED", "user", user.getId(), null, null);
        return authenticatedResponse(user);
    }

    @Transactional(noRollbackFor = TokenReuseException.class)
    public Map<String, Object> refresh(String rawToken) {
        RefreshToken current = refreshTokenRepository
                .findForUpdateByHash(refreshTokenService.rawForLookup(rawToken))
                .orElseThrow(() -> ApiException.unauthorized("INVALID_REFRESH_TOKEN",
                        "Refresh token is invalid"));
        if (current.getRevokedAt() != null) {
            refreshTokenRepository.revokeFamily(current.getFamilyId(), Instant.now());
            auditService.record(current.getUserId(), "REFRESH_TOKEN_REUSE_DETECTED", "user",
                    current.getUserId(), null, Map.of("familyId", current.getFamilyId()));
            throw new TokenReuseException();
        }
        if (current.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.unauthorized("REFRESH_TOKEN_EXPIRED", "Refresh token has expired");
        }
        User user = requireUser(current.getUserId());
        if (user.getStatus() == UserStatus.SUSPENDED || user.getStatus() == UserStatus.PENDING_EMAIL) {
            throw ApiException.forbidden("ACCOUNT_UNAVAILABLE", "This account cannot sign in");
        }
        String newRefresh = refreshTokenService.rotate(current, user);
        Map<String, Object> response = authenticatedResponse(user, newRefresh);
        return response;
    }

    @Transactional
    public void logout(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        refreshTokenRepository.findByTokenHash(refreshTokenService.rawForLookup(rawToken))
                .ifPresent(token -> {
                    token.setRevokedAt(Instant.now());
                    refreshTokenRepository.save(token);
                    auditService.record(token.getUserId(), "LOGOUT", "user", token.getUserId(),
                            null, null);
                });
    }

    @Transactional
    public Map<String, Object> forgotPassword(String email) {
        String normalized = normalizeEmail(email);
        Optional<User> optional = userRepository.findByEmailIgnoreCase(normalized);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "If the account exists, a reset link has been sent");
        optional.ifPresent(user -> {
            String token = emailTokenService.create(user.getId(), EmailToken.Purpose.RESET,
                    Duration.ofMinutes(30));
            emailService.sendPasswordReset(user.getEmail(), token);
            auditService.record(user.getId(), "PASSWORD_RESET_REQUESTED", "user", user.getId(),
                    null, null);
            if (properties.getDev().isExposeEmailTokens()) {
                response.put("devResetToken", token);
            }
        });
        return response;
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        passwordPolicy.validate(newPassword);
        EmailToken token = emailTokenService.consume(rawToken, EmailToken.Purpose.RESET);
        User user = requireUser(token.getUserId());
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setTokenVersion(user.getTokenVersion() + 1);
        user.setFailedLoginCount(0);
        user.setLockedUntil(null);
        userRepository.save(user);
        refreshTokenRepository.revokeAllForUser(user.getId(), Instant.now());
        auditService.record(user.getId(), "PASSWORD_RESET", "user", user.getId(), null, null);
    }

    @Transactional
    public Map<String, Object> acceptInvite(String rawToken, String password) {
        passwordPolicy.validate(password);
        EmailToken token = emailTokenService.consume(rawToken, EmailToken.Purpose.INVITE);
        User user = requireUser(token.getUserId());
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setEmailVerifiedAt(Instant.now());
        user.setStatus(UserStatus.ACTIVE);
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);
        refreshTokenRepository.revokeAllForUser(user.getId(), Instant.now());
        auditService.record(user.getId(), "INVITE_ACCEPTED", "user", user.getId(), null,
                Map.of("role", user.getRole().name()));

        if (!requiredMfa(user)) {
            return authenticatedResponse(user);
        }
        Map<String, Object> response = baseUserResponse(user);
        response.put("status", "mfa_setup_required");
        response.put("enrollmentToken", jwtService.createPurposeToken(user.getId(), MFA_SETUP, 10));
        return response;
    }

    public String createInviteToken(User target) {
        String token = emailTokenService.create(target.getId(), EmailToken.Purpose.INVITE, 72);
        emailService.sendInvite(target.getEmail(), token, target.getRole().apiValue());
        auditService.record("INVITE_CREATED", "user", target.getId(), null,
                Map.of("role", target.getRole().name(), "email", target.getEmail()));
        return token;
    }

    public Map<String, Object> authenticatedResponse(User user) {
        return authenticatedResponse(user, null);
    }

    private Map<String, Object> authenticatedResponse(User user, String providedRefreshToken) {
        String refreshToken = providedRefreshToken != null ? providedRefreshToken
                : refreshTokenService.create(user);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "authenticated");
        response.put("accessToken", jwtService.createAccessToken(user));
        response.put("refreshToken", refreshToken);
        response.put("expiresIn", jwtService.accessTokenSeconds());
        response.put("restricted", user.getStatus() != UserStatus.ACTIVE);
        response.put("user", userSummary(user));
        return response;
    }

    public Map<String, Object> userSummary(User user) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("id", user.getId());
        summary.put("email", user.getEmail());
        summary.put("fullName", user.getFullName());
        summary.put("role", user.getRole().apiValue());
        summary.put("status", user.getStatus().apiValue());
        summary.put("restricted", user.getStatus() != UserStatus.ACTIVE);
        summary.put("mfaEnabled", user.isMfaEnabled());
        summary.put("emailVerified", user.getEmailVerifiedAt() != null);
        return summary;
    }

    private Map<String, Object> baseUserResponse(User user) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("restricted", user.getStatus() != UserStatus.ACTIVE);
        response.put("user", userSummary(user));
        return response;
    }

    private boolean requiredMfa(User user) {
        // Administrators sign in with their password only; MFA stays mandatory for auditors.
        if (user.getRole() == Role.ADMIN) {
            return false;
        }
        String configured = settingService.get("mfa.required.roles", "AUDITOR");
        for (String role : configured.split(",")) {
            if (role.trim().equalsIgnoreCase(user.getRole().name())) {
                return true;
            }
        }
        return user.getRole() == Role.AUDITOR;
    }

    private UUID userIdFromPurposeToken(String token, String expectedPurpose) {
        try {
            Claims claims = jwtService.parse(token);
            if (!JwtService.TYPE_PURPOSE.equals(jwtService.type(claims))
                    || !expectedPurpose.equals(jwtService.purpose(claims))) {
                throw ApiException.unauthorized("TOKEN_INVALID", "Token has the wrong purpose");
            }
            return jwtService.userId(claims);
        } catch (ApiException ex) {
            throw ex;
        } catch (Exception ex) {
            throw ApiException.unauthorized("TOKEN_INVALID", "Token is invalid or expired");
        }
    }

    private User requireUser(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> ApiException.unauthorized("USER_NOT_FOUND", "User no longer exists"));
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    private String dummyHash() {
        if (dummyHash == null) {
            dummyHash = passwordEncoder.encode("not-a-real-password-12345");
        }
        return dummyHash;
    }
}
