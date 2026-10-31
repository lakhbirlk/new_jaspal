package com.example.directory.payment;

import com.example.directory.auth.AuthPrincipal;
import com.example.directory.common.ApiException;
import com.example.directory.common.PageResult;
import com.example.directory.listing.ListingSubscription;
import com.example.directory.listing.ListingSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.*;

@RestController
@RequestMapping("/api/v1/admin/payments")
@RequiredArgsConstructor
public class PaymentAdminController {

    private final PaymentService paymentService;
    private final PaymentRepository paymentRepository;
    private final PaymentDashboardService dashboardService;
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

    @GetMapping("/dashboard")
    @PreAuthorize("hasAuthority('payment:read')")
    public PaymentDashboardService.DashboardMetrics getDashboardMetrics() {
        return dashboardService.getMetrics();
    }

    @GetMapping("/analytics")
    @PreAuthorize("hasAuthority('payment:read')")
    public PaymentDashboardService.RevenueAnalytics getRevenueAnalytics(
            @RequestParam(required = false) String period,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String currency) {
        return dashboardService.getAnalytics(period, from, to, currency);
    }

    @GetMapping("/transactions")
    @PreAuthorize("hasAuthority('payment:read')")
    public PageResult<Map<String, Object>> getTransactions(
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "20") Integer size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) String gateway,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String direction) {
        return dashboardService.getTransactions(page, size, status, dateFrom, dateTo, gateway, search,
                sort, direction);
    }

    @GetMapping("/transactions/{id}")
    @PreAuthorize("hasAuthority('payment:read')")
    public Map<String, Object> getTransactionDetails(@PathVariable UUID id) {
        return dashboardService.getTransactionDetails(id);
    }

    @GetMapping("/transactions/export")
    @PreAuthorize("hasAuthority('payment:read')")
    public ResponseEntity<byte[]> exportTransactions(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) String gateway,
            @RequestParam(required = false) String search,
            @AuthenticationPrincipal AuthPrincipal admin) {
        List<Map<String, Object>> rows = dashboardService.exportTransactions(
                status, dateFrom, dateTo, gateway, search);
        dashboardService.auditExport(admin.id(), status, dateFrom, dateTo, gateway, search, rows.size());

        StringBuilder csv = new StringBuilder();
        csv.append("Transaction ID,Order ID,Customer,Customer Email,Amount,Currency,Gateway,")
                .append("Gateway Reference,Status,Created At,Paid At,Refunded At,Failure Reason\n");
        for (Map<String, Object> row : rows) {
            csv.append(csvValue(row.get("id"))).append(',')
                    .append(csvValue(row.get("orderId"))).append(',')
                    .append(csvValue(row.get("customerName"))).append(',')
                    .append(csvValue(row.get("customerEmail"))).append(',')
                    .append(csvValue(row.get("amount"))).append(',')
                    .append(csvValue(row.get("currency"))).append(',')
                    .append(csvValue(row.get("gateway"))).append(',')
                    .append(csvValue(row.get("providerRef"))).append(',')
                    .append(csvValue(row.get("status"))).append(',')
                    .append(csvValue(row.get("createdAt"))).append(',')
                    .append(csvValue(row.get("paidAt"))).append(',')
                    .append(csvValue(row.get("refundedAt"))).append(',')
                    .append(csvValue(row.get("failureReason"))).append('\n');
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", "payment-transactions.csv");
        return ResponseEntity.ok().headers(headers).body(csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    private String csvValue(Object value) {
        if (value == null) return "";
        String str = value.toString();
        if (str.contains(",") || str.contains("\"") || str.contains("\n")) {
            return "\"" + str.replace("\"", "\"\"") + "\"";
        }
        return str;
    }
}
