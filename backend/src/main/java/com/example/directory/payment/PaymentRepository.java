package com.example.directory.payment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID>,
        JpaSpecificationExecutor<Payment> {

    List<Payment> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<Payment> findByProviderRef(String providerRef);

    Optional<Payment> findFirstByPurposeAndReferenceIdAndStatusOrderByCreatedAtDesc(
            PaymentPurpose purpose, UUID referenceId, PaymentStatus status);

    List<Payment> findByStatusAndCreatedAtBefore(PaymentStatus status, Instant cutoff);

    @Query("SELECT COUNT(p) FROM Payment p WHERE p.status = :status")
    Long countByStatus(@Param("status") PaymentStatus status);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.status = :status")
    BigDecimal calculateTotalRevenueByStatus(@Param("status") PaymentStatus status);

    /**
     * Revenue per currency recognised within [from, to). Payment counts as collected when it
     * was confirmed ({@code paidAt}); rows without a confirmation timestamp fall back to
     * {@code createdAt}. Amounts are never summed across currencies.
     */
    @Query("""
            SELECT p.currency, COALESCE(SUM(p.amount), 0) FROM Payment p
            WHERE p.status = com.example.directory.payment.PaymentStatus.PAID
              AND COALESCE(p.paidAt, p.createdAt) >= :from
              AND COALESCE(p.paidAt, p.createdAt) < :to
            GROUP BY p.currency
            """)
    List<Object[]> revenueByCurrencyBetween(@Param("from") Instant from, @Param("to") Instant to);

    /** Revenue for a single currency within [from, to). */
    @Query("""
            SELECT COALESCE(SUM(p.amount), 0) FROM Payment p
            WHERE p.status = com.example.directory.payment.PaymentStatus.PAID
              AND p.currency = :currency
              AND COALESCE(p.paidAt, p.createdAt) >= :from
              AND COALESCE(p.paidAt, p.createdAt) < :to
            """)
    BigDecimal calculateRevenueBetween(@Param("from") Instant from, @Param("to") Instant to,
                                       @Param("currency") String currency);

    @Query("SELECT DISTINCT p.currency FROM Payment p ORDER BY p.currency")
    List<String> findDistinctCurrencies();
}
