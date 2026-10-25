package com.example.directory.listing;

import java.util.Locale;

public enum ListingStatus {
    NOT_APPROVED,
    UNLISTED_BY_ADMIN,
    AWAITING_PLAN,
    EXPIRED,
    LISTED;

    public String apiValue() {
        return name().toLowerCase(Locale.ROOT);
    }
}
