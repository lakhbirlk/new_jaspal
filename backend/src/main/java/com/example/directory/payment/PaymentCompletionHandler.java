package com.example.directory.payment;

/**
 * Called inside the same transaction that marks a payment paid. Implementations activate the
 * thing that was bought (for example a business listing).
 */
public interface PaymentCompletionHandler {

    PaymentPurpose purpose();

    void onPaid(Payment payment);
}
