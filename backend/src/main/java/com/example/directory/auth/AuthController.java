package com.example.directory.auth;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@Valid @RequestBody AuthRequests.Register request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/verify-email")
    public Map<String, Object> verifyEmail(@Valid @RequestBody AuthRequests.VerifyEmail request) {
        return authService.verifyEmail(request.token());
    }

    @PostMapping("/login")
    public Map<String, Object> login(@Valid @RequestBody AuthRequests.Login request) {
        return authService.login(request);
    }

    @PostMapping("/mfa/verify")
    public Map<String, Object> mfaVerify(@Valid @RequestBody AuthRequests.MfaVerify request) {
        return authService.mfaVerify(request.challengeToken(), request.code());
    }

    @PostMapping("/mfa/setup")
    public Map<String, Object> mfaSetup(@RequestBody(required = false) AuthRequests.MfaSetup request,
                                        @AuthenticationPrincipal AuthPrincipal principal) {
        return authService.mfaSetup(request == null ? null : request.enrollmentToken(), principal);
    }

    @PostMapping("/mfa/enable")
    public Map<String, Object> mfaEnable(@Valid @RequestBody AuthRequests.MfaEnable request,
                                         @AuthenticationPrincipal AuthPrincipal principal) {
        return authService.mfaEnable(request.enrollmentToken(), request.code(), principal);
    }

    @PostMapping("/refresh")
    public Map<String, Object> refresh(@Valid @RequestBody AuthRequests.Refresh request) {
        return authService.refresh(request.refreshToken());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestBody(required = false) AuthRequests.Logout request) {
        authService.logout(request == null ? null : request.refreshToken());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/forgot-password")
    public Map<String, Object> forgotPassword(@Valid @RequestBody AuthRequests.ForgotPassword request) {
        return authService.forgotPassword(request.email());
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody AuthRequests.ResetPassword request) {
        authService.resetPassword(request.token(), request.newPassword());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/accept-invite")
    public Map<String, Object> acceptInvite(@Valid @RequestBody AuthRequests.AcceptInvite request) {
        return authService.acceptInvite(request.token(), request.password());
    }
}
