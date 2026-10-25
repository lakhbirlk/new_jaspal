package com.example.directory.user;

import java.util.Locale;

public enum UserStatus {
    PENDING_EMAIL,
    PENDING_PROFILE,
    PENDING_REVIEW,
    ACTIVE,
    REJECTED,
    SUSPENDED;

    public boolean isRestricted() {
        return this != ACTIVE;
    }

    public String apiValue() {
        return name().toLowerCase(Locale.ROOT);
    }
}
