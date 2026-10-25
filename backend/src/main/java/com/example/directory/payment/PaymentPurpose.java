package com.example.directory.payment;

import java.util.Locale;

public enum PaymentPurpose {
    LISTING,
    RESEARCHER_PLAN;

    public String apiValue() {
        return name().toLowerCase(Locale.ROOT);
    }
}
