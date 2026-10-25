package com.example.directory.listing;

import com.example.directory.audit.AuditLogRepository;
import com.example.directory.audit.AuditService;
import com.example.directory.auth.EmailService;
import com.example.directory.business.Business;
import com.example.directory.business.BusinessRepository;
import com.example.directory.config.AppProperties;
import com.example.directory.payment.Payment;
import com.example.directory.payment.PaymentRepository;
import com.example.directory.payment.PaymentStatus;
import com.example.directory.user.User;
import com.example.directory.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

@Slf4j
@Component
@RequiredArgsConstructor
public class ListingExpiryJob {

    private final ListingSubscriptionRepository listingRepository;
    private final PaymentRepository paymentRepository;
    private final BusinessRepository businessRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final AuditService auditService;
    private final AuditLogRepository auditLogRepository;
    private final AppProperties properties;

    @Scheduled(fixedDelayString = "PT10M", initialDelayString = "PT1M")
    @Transactional
    public void run() {
        Instant now = Instant.now();
        expireListings(now);
        expireUnpaidListings(now);
        sendReminders(now);
    }

    private void expireListings(Instant now) {
        List<ListingSubscription> expired = listingRepository
                .findByStatusAndEndsAtBefore(ListingSubscriptionStatus.ACTIVE, now);
        for (ListingSubscription listing : expired) {
            listing.setStatus(ListingSubscriptionStatus.EXPIRED);
            listingRepository.save(listing);
            auditService.record("LISTING_EXPIRED", "listing", listing.getId(), null,
                    java.util.Map.of("status", "expired", "endsAt", listing.getEndsAt()));
            log.info("Expired listing {}", listing.getId());
        }
    }

    private void expireUnpaidListings(Instant now) {
        Instant cutoff = now.minus(Duration.ofHours(24));
        List<ListingSubscription> unpaid = listingRepository
                .findByStatusAndCreatedAtBefore(ListingSubscriptionStatus.PENDING_PAYMENT, cutoff);
        for (ListingSubscription listing : unpaid) {
            listing.setStatus(ListingSubscriptionStatus.CANCELLED);
            listingRepository.save(listing);
            paymentRepository.findFirstByPurposeAndReferenceIdAndStatusOrderByCreatedAtDesc(
                            com.example.directory.payment.PaymentPurpose.LISTING,
                            listing.getId(), PaymentStatus.PENDING)
                    .ifPresent(payment -> {
                        payment.setStatus(PaymentStatus.FAILED);
                        paymentRepository.save(payment);
                    });
            auditService.record("LISTING_PAYMENT_EXPIRED", "listing", listing.getId(), null,
                    java.util.Map.of("status", "cancelled", "reason", "payment not completed in 24h"));
            log.info("Cancelled unpaid listing {}", listing.getId());
        }
    }

    private void sendReminders(Instant now) {
        int days = Math.max(properties.getListing().getReminderDays(), 1);
        Instant until = now.plus(Duration.ofDays(days));
        List<ListingSubscription> expiring = listingRepository
                .findByStatusAndEndsAtBetween(ListingSubscriptionStatus.ACTIVE, now, until);
        for (ListingSubscription listing : expiring) {
            if (auditLogRepository.existsByActionAndResourceId("LISTING_REMINDER", listing.getId())) {
                continue;
            }
            Business business = businessRepository.findById(listing.getBusinessId()).orElse(null);
            if (business == null || business.getOwnerUserId() == null) {
                continue;
            }
            User owner = userRepository.findById(business.getOwnerUserId()).orElse(null);
            if (owner == null) {
                continue;
            }
            String date = DateTimeFormatter.ISO_INSTANT.format(listing.getEndsAt());
            emailService.sendListingExpiryReminder(owner.getEmail(), business.getLegalName(), date);
            auditService.record("LISTING_REMINDER", "listing", listing.getId(), null,
                    java.util.Map.of("endsAt", listing.getEndsAt().toString(),
                            "email", owner.getEmail()));
            log.info("Sent listing expiry reminder for {}", listing.getId());
        }
    }
}
