package com.example.directory.payment;

import com.example.directory.auth.AuthPrincipal;
import com.example.directory.common.ApiException;
import com.example.directory.common.PageResult;
import com.example.directory.listing.ListingSubscription;
import com.example.directory.listing.ListingSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/payments")
@RequiredArgsConstructor
public class PaymentAdminController {

    private final PaymentService paymentService;
    private final PaymentRepository paymentRepository;
    private final ListingSubscriptionRepository listingRepository;

    @GetMapping
    @PreAuthorize("hasAuthority('payment:read')")
    public PageResult<Map<String, Object>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return paymentService.adminList(status, userId, page, size);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('payment:manage')")
    public Map<String, Object> recordOffline(@RequestBody Map<String, Object> payload,
                                             @AuthenticationPrincipal AuthPrincipal admin) {
        String providerRef = text(payload.get("providerRef"));
        UUID paymentId = uuid(payload.get("paymentId"));
        if (paymentId != null) {
            return paymentService.markPaid(paymentId, admin.id(), providerRef);
        }

        UUID referenceId = uuid(payload.get("referenceId"));
        if (referenceId == null) {
            referenceId = uuid(payload.get("listingId"));
        }
        if (referenceId == null) {
            throw ApiException.badRequest("PAYMENT_REFERENCE_REQUIRED",
                    "paymentId or referenceId/listingId is required");
        }
        PaymentPurpose purpose = parsePurpose(text(payload.get("purpose")));
        if (purpose == null) {
            purpose = PaymentPurpose.LISTING;
        }

        Payment payment = paymentRepository
                .findFirstByPurposeAndReferenceIdAndStatusOrderByCreatedAtDesc(
                        purpose, referenceId, PaymentStatus.PENDING)
                .orElse(null);
        if (payment == null) {
            if (purpose == PaymentPurpose.LISTING) {
                ListingSubscription listing = listingRepository.findById(referenceId)
                        .orElseThrow(() -> ApiException.notFound("LISTING_NOT_FOUND",
                                "Listing not found"));
                payment = paymentService.createPending(listing.getPurchasedBy(),
                        PaymentPurpose.LISTING, listing.getId(), listing.getAmount(),
                        listing.getCurrency(), "MANUAL");
            } else {
                throw ApiException.notFound("PENDING_PAYMENT_NOT_FOUND",
                        "No pending payment exists for that reference");
            }
        }
        return paymentService.markPaid(payment, admin.id(), providerRef);
    }

    @PostMapping("/{id}/refund")
    @PreAuthorize("hasAuthority('payment:manage')")
    public Map<String, Object> refund(@PathVariable UUID id,
                                      @RequestBody(required = false) Map<String, Object> payload,
                                      @AuthenticationPrincipal AuthPrincipal admin) {
        return paymentService.refund(id, admin.id(),
                payload == null ? null : text(payload.get("reason")));
    }

    private PaymentPurpose parsePurpose(String value) {
        if (value == null) return null;
        try {
            return PaymentPurpose.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            throw ApiException.badRequest("INVALID_PURPOSE", "Unknown payment purpose");
        }
    }

    private UUID uuid(Object value) {
        if (value == null || value.toString().isBlank()) return null;
        try {
            return UUID.fromString(value.toString());
        } catch (Exception ex) {
            throw ApiException.badRequest("INVALID_ID", "Invalid identifier: " + value);
        }
    }

    private String text(Object value) {
        if (value == null) return null;
        String text = value.toString().trim();
        return text.isEmpty() ? null : text;
    }
}
