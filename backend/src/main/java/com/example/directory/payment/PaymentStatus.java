package com.example.directory.payment;

import java.util.Locale;

public enum PaymentStatus {
    PENDING,
    PAID,
    FAILED,
    REFUNDED;

    public String apiValue() {
        return name().toLowerCase(Locale.ROOT);
    }
}
