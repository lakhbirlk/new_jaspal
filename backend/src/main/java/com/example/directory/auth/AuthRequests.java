package com.example.directory.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthRequests {

    private AuthRequests() {
    }

    public record Register(
            @NotBlank @Email @Size(max = 320) String email,
            @NotBlank @Size(max = 200) String fullName,
            @NotBlank @Size(min = 10, max = 200) String password,
            @NotBlank String role,
            @Size(max = 300) String businessName) {
    }

    public record VerifyEmail(@NotBlank String token) {
    }

    public record Login(
            @NotBlank @Email String email,
            @NotBlank String password) {
    }

    public record MfaVerify(@NotBlank String challengeToken, @NotBlank String code) {
    }

    public record MfaSetup(String enrollmentToken) {
    }

    public record MfaEnable(String enrollmentToken, @NotBlank String code) {
    }

    public record Refresh(@NotBlank String refreshToken) {
    }

    public record Logout(String refreshToken) {
    }

    public record ForgotPassword(@NotBlank @Email String email) {
    }

    public record ResetPassword(@NotBlank String token,
                                @NotBlank @Size(min = 10, max = 200) String newPassword) {
    }

    public record AcceptInvite(@NotBlank String token,
                               @NotBlank @Size(min = 10, max = 200) String password) {
    }
}
