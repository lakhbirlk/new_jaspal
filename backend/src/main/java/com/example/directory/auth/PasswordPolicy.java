package com.example.directory.auth;

import com.example.directory.common.ApiException;
import com.example.directory.user.AppSettingService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class PasswordPolicy {

    private static final Set<String> COMMON = Set.of(
            "password", "password1", "password123", "1234567890", "qwerty123",
            "letmein123", "welcome123", "admin12345", "password1234");

    private final AppSettingService settingService;

    public void validate(String password) {
        int minLength = Math.max(10, settingService.getInt("password.min.length", 10));
        if (password == null || password.length() < minLength) {
            throw weak("Password must be at least " + minLength + " characters");
        }
        if (password.length() > 200) {
            throw weak("Password must be at most 200 characters");
        }
        boolean letter = password.chars().anyMatch(Character::isLetter);
        boolean digit = password.chars().anyMatch(Character::isDigit);
        if (!letter || !digit) {
            throw weak("Password must contain at least one letter and one number");
        }
        if (COMMON.contains(password.toLowerCase(Locale.ROOT))) {
            throw weak("This password is too common");
        }
    }

    private ApiException weak(String message) {
        return ApiException.unprocessable("WEAK_PASSWORD", message,
                Map.of("requirements", List.of("At least 10 characters", "A letter", "A number",
                        "Not a commonly used password")));
    }
}
