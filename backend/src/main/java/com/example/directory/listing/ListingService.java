package com.example.directory.listing;

import com.example.directory.audit.AuditService;
import com.example.directory.auth.AuthPrincipal;
import com.example.directory.business.*;
import com.example.directory.common.ApiException;
import com.example.directory.common.PageResult;
import com.example.directory.config.AppProperties;
import com.example.directory.payment.*;
import com.example.directory.subscription.Plan;
import com.example.directory.subscription.PlanAudience;
import com.example.directory.subscription.PlanRepository;
import com.example.directory.subscription.PlanService;
import com.example.directory.user.User;
import com.example.directory.user.UserRepository;
import com.example.directory.user.UserStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ListingService implements PaymentCompletionHandler {

    private final ListingSubscriptionRepository listingRepository;
    private final ListingStatusService statusService;
    private final BusinessRepository businessRepository;
    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;
    private final PlanRepository planRepository;
    private final PlanService planService;
    private final AuditService auditService;
    private final AppProperties properties;

    @Override
    public PaymentPurpose purpose() {
        return PaymentPurpose.LISTING;
    }

    @Transactional
    public Map<String, Object> purchase(AuthPrincipal principal, String planCode) {
        User user = requireUser(principal.id());
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw ApiException.forbidden("ACCOUNT_NOT_ACTIVE",
                    "The business must be approved before buying a listing");
        }
        Business business = requireOwned(principal.id());
        Plan plan = planService.requireActivePlan(planCode, PlanAudience.BUSINESS);

        ListingSubscription listing = new ListingSubscription();
        listing.setBusinessId(business.getId());
        listing.setPurchasedBy(principal.id());
        listing.setPlanId(plan.getId());
        listing.setStatus(ListingSubscriptionStatus.PENDING_PAYMENT);
        listing.setAmount(plan.getPriceAmount());
        listing.setCurrency(plan.getCurrency());
        listing = listingRepository.save(listing);

        Payment payment = new Payment();
        payment.setUserId(principal.id());
        payment.setPurpose(PaymentPurpose.LISTING);
        payment.setReferenceId(listing.getId());
        payment.setAmount(plan.getPriceAmount());
        payment.setCurrency(plan.getCurrency());
        payment.setProvider("MANUAL");
        payment.setStatus(PaymentStatus.PENDING);
        payment = paymentRepository.save(payment);
        listing.setPaymentId(payment.getId());
        listingRepository.save(listing);

        auditService.record(principal.id(), "LISTING_PURCHASE_STARTED", "listing", listing.getId(),
                null, listingMap(listing));
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("listing", listingMap(listing));
        response.put("payment", paymentMap(payment));
        response.put("message", "Complete the payment to activate the listing");
        return response;
    }

    public Map<String, Object> myListing(AuthPrincipal principal) {
        Business business = requireOwned(principal.id());
        List<ListingSubscription> history =
                listingRepository.findByBusinessIdOrderByCreatedAtDesc(business.getId());
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("businessId", business.getId());
        response.put("listingStatus", statusService.statusOf(business).apiValue());
        response.put("listedUntil", business.getListedUntil());
        response.put("adminListingStatus", business.getAdminListingStatus().name().toLowerCase(Locale.ROOT));
        response.put("history", history.stream().map(this::listingMap).toList());
        response.put("payments", paymentRepository.findByUserIdOrderByCreatedAtDesc(principal.id())
                .stream().filter(payment -> payment.getPurpose() == PaymentPurpose.LISTING)
                .map(this::paymentMap).toList());
        return response;
    }

    @Override
    @Transactional
    public void onPaid(Payment payment) {
        ListingSubscription listing = listingRepository.findById(payment.getReferenceId())
                .orElseThrow(() -> ApiException.notFound("LISTING_NOT_FOUND",
                        "The listing for this payment no longer exists"));
        if (listing.getStatus() == ListingSubscriptionStatus.ACTIVE) {
            return;
        }
        if (listing.getStatus() != ListingSubscriptionStatus.PENDING_PAYMENT) {
            throw ApiException.conflict("LISTING_NOT_PENDING",
                    "The listing is not awaiting payment");
        }
        Plan resolved = planRepository.findById(listing.getPlanId())
                .orElseThrow(() -> ApiException.notFound("PLAN_NOT_FOUND",
                        "The plan for this listing no longer exists"));
        Business business = businessRepository.findById(listing.getBusinessId())
                .orElseThrow(() -> ApiException.notFound("BUSINESS_NOT_FOUND", "Business not found"));

        Instant now = Instant.now();
        Instant startsAt = business.getListedUntil() != null && business.getListedUntil().isAfter(now)
                ? business.getListedUntil() : now;
        Instant endsAt = addMonths(startsAt, resolved.getDurationMonths());
        listing.setStatus(ListingSubscriptionStatus.ACTIVE);
        listing.setStartsAt(startsAt);
        listing.setEndsAt(endsAt);
        listing.setPaymentId(payment.getId());
        listingRepository.save(listing);

        business.setListedUntil(endsAt);
        businessRepository.save(business);
        auditService.record(payment.getRecordedBy(), "LISTING_ACTIVATED", "listing", listing.getId(),
                null, listingMap(listing));
    }

    public PageResult<Map<String, Object>> adminList(String statusValue, int page, int size) {
        String filter = statusValue == null ? null : statusValue.trim().toLowerCase(Locale.ROOT);
        if (filter != null && !filter.isEmpty() && !filter.equals("expiring")) {
            try {
                ListingStatus.valueOf(filter.toUpperCase(Locale.ROOT));
            } catch (Exception ex) {
                throw ApiException.badRequest("INVALID_STATUS", "Unknown listing status");
            }
        }
        Instant soon = Instant.now().plus(Duration.ofDays(Math.max(properties.getListing().getReminderDays(), 1)));
        List<Map<String, Object>> items = new ArrayList<>();
        for (Business business : businessRepository.findAll()) {
            ListingStatus status = statusService.statusOf(business);
            boolean expiring = status == ListingStatus.LISTED && business.getListedUntil() != null
                    && business.getListedUntil().isBefore(soon);
            if (filter != null && !filter.isEmpty()) {
                if (filter.equals("expiring")) {
                    if (!expiring) continue;
                } else if (!status.apiValue().equals(filter)) {
                    continue;
                }
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("businessId", business.getId());
            item.put("legalName", business.getLegalName());
            item.put("ownerUserId", business.getOwnerUserId());
            item.put("listingStatus", status.apiValue());
            item.put("listedUntil", business.getListedUntil());
            item.put("adminListingStatus", business.getAdminListingStatus().name().toLowerCase(Locale.ROOT));
            item.put("expiringSoon", expiring);
            listingRepository.findFirstByBusinessIdAndStatusOrderByEndsAtDesc(
                            business.getId(), ListingSubscriptionStatus.ACTIVE)
                    .ifPresent(listing -> {
                        item.put("listingId", listing.getId());
                        item.put("planId", listing.getPlanId());
                        item.put("listingEndsAt", listing.getEndsAt());
                        item.put("amount", listing.getAmount());
                        item.put("currency", listing.getCurrency());
                    });
            items.add(item);
        }
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        int from = Math.min(safePage * safeSize, items.size());
        int to = Math.min(from + safeSize, items.size());
        List<Map<String, Object>> pageItems = items.subList(from, to);
        int totalPages = (int) Math.ceil(items.size() / (double) safeSize);
        return new PageResult<>(pageItems, safePage, safeSize, items.size(), totalPages);
    }

    @Transactional
    public Map<String, Object> setAdminListing(UUID businessId, boolean listed, AuthPrincipal admin) {
        Business business = requireBusiness(businessId);
        Map<String, Object> before = Map.of(
                "adminListingStatus", business.getAdminListingStatus().name().toLowerCase(Locale.ROOT),
                "listingStatus", statusService.statusOf(business).apiValue());
        business.setAdminListingStatus(listed ? AdminListingStatus.LISTED : AdminListingStatus.UNLISTED);
        businessRepository.save(business);
        Map<String, Object> after = new LinkedHashMap<>();
        after.put("adminListingStatus", business.getAdminListingStatus().name().toLowerCase(Locale.ROOT));
        after.put("listingStatus", statusService.statusOf(business).apiValue());
        auditService.record(admin.id(), listed ? "BUSINESS_LISTED" : "BUSINESS_UNLISTED",
                "business", businessId, before, after);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("businessId", businessId);
        response.putAll(after);
        response.put("listedUntil", business.getListedUntil());
        return response;
    }

    @Transactional
    public Map<String, Object> adminExtend(UUID businessId, int months, AuthPrincipal admin,
                                           String reason) {
        if (months < 1 || months > 120) {
            throw ApiException.badRequest("INVALID_DURATION", "months must be between 1 and 120");
        }
        Business business = requireBusiness(businessId);
        ListingSubscription listing = listingRepository
                .findFirstByBusinessIdAndStatusOrderByEndsAtDesc(businessId,
                        ListingSubscriptionStatus.ACTIVE)
                .orElseThrow(() -> ApiException.conflict("NO_ACTIVE_LISTING",
                        "This business has no active paid listing to extend"));
        Instant from = business.getListedUntil() != null
                && business.getListedUntil().isAfter(Instant.now())
                ? business.getListedUntil() : Instant.now();
        Instant endsAt = addMonths(from, months);
        Map<String, Object> before = listingMap(listing);
        listing.setEndsAt(endsAt);
        listingRepository.save(listing);
        business.setListedUntil(endsAt);
        businessRepository.save(business);
        Map<String, Object> after = listingMap(listing);
        after.put("reason", reason);
        auditService.record(admin.id(), "LISTING_EXTENDED", "listing", listing.getId(), before, after);
        return after;
    }

    @Transactional
    public Map<String, Object> adminCancel(UUID businessId, AuthPrincipal admin, String reason) {
        Business business = requireBusiness(businessId);
        List<ListingSubscription> listings = listingRepository.findByBusinessIdAndStatusIn(
                businessId, List.of(ListingSubscriptionStatus.ACTIVE,
                        ListingSubscriptionStatus.PENDING_PAYMENT));
        if (listings.isEmpty()) {
            throw ApiException.conflict("NO_ACTIVE_LISTING", "This business has no listing to cancel");
        }
        Instant now = Instant.now();
        List<Map<String, Object>> cancelled = new ArrayList<>();
        for (ListingSubscription listing : listings) {
            Map<String, Object> before = listingMap(listing);
            listing.setStatus(ListingSubscriptionStatus.CANCELLED);
            listing.setEndsAt(now);
            listingRepository.save(listing);
            paymentRepository.findFirstByPurposeAndReferenceIdAndStatusOrderByCreatedAtDesc(
                            PaymentPurpose.LISTING, listing.getId(), PaymentStatus.PENDING)
                    .ifPresent(payment -> {
                        payment.setStatus(PaymentStatus.FAILED);
                        paymentRepository.save(payment);
                    });
            Map<String, Object> after = listingMap(listing);
            after.put("reason", reason);
            cancelled.add(after);
            auditService.record(admin.id(), "LISTING_CANCELLED", "listing", listing.getId(),
                    before, after);
        }
        business.setListedUntil(now);
        businessRepository.save(business);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("businessId", businessId);
        response.put("listingStatus", statusService.statusOf(business).apiValue());
        response.put("cancelled", cancelled);
        return response;
    }

    private Business requireOwned(UUID userId) {
        return businessRepository.findByOwnerUserId(userId)
                .orElseThrow(() -> ApiException.notFound("BUSINESS_NOT_FOUND",
                        "No business is associated with this account"));
    }

    private Business requireBusiness(UUID businessId) {
        return businessRepository.findById(businessId)
                .orElseThrow(() -> ApiException.notFound("BUSINESS_NOT_FOUND", "Business not found"));
    }

    private User requireUser(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "User not found"));
    }

    private Instant addMonths(Instant from, int months) {
        return from.atZone(ZoneOffset.UTC).plusMonths(months).toInstant();
    }

    public Map<String, Object> listingMap(ListingSubscription listing) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", listing.getId());
        map.put("businessId", listing.getBusinessId());
        map.put("purchasedBy", listing.getPurchasedBy());
        map.put("planId", listing.getPlanId());
        map.put("status", listing.getStatus().name().toLowerCase(Locale.ROOT));
        map.put("startsAt", listing.getStartsAt());
        map.put("endsAt", listing.getEndsAt());
        map.put("amount", listing.getAmount());
        map.put("currency", listing.getCurrency());
        map.put("paymentId", listing.getPaymentId());
        map.put("createdAt", listing.getCreatedAt());
        return map;
    }

    private Map<String, Object> paymentMap(Payment payment) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", payment.getId());
        map.put("purpose", payment.getPurpose().apiValue());
        map.put("referenceId", payment.getReferenceId());
        map.put("amount", payment.getAmount());
        map.put("currency", payment.getCurrency());
        map.put("provider", payment.getProvider());
        map.put("status", payment.getStatus().apiValue());
        map.put("createdAt", payment.getCreatedAt());
        map.put("paidAt", payment.getPaidAt());
        return map;
    }
}
