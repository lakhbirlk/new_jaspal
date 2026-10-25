package com.example.directory.user;

import java.util.Locale;

public enum Role {
    ADMIN, AUDITOR, RESEARCHER, BUSINESS;

    public static Role from(String value) {
        if (value == null) {
            throw new IllegalArgumentException("Role is required");
        }
        try {
            return Role.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unknown role: " + value);
        }
    }

    public String apiValue() {
        return name().toLowerCase(Locale.ROOT);
    }
}
