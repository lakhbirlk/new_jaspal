package com.example.directory.subscription;

import com.example.directory.audit.AuditService;
import com.example.directory.auth.AuthPrincipal;
import com.example.directory.business.Business;
import com.example.directory.business.BusinessRepository;
import com.example.directory.business.BusinessService;
import com.example.directory.common.ApiException;
import com.example.directory.common.PageResult;
import com.example.directory.listing.ListingStatusService;
import com.example.directory.policy.PolicyEngine;
import com.example.directory.policy.UnlockState;
import com.example.directory.user.Role;
import com.example.directory.user.User;
import com.example.directory.user.UserRepository;
import com.example.directory.user.UserStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.*;

@Service
@RequiredArgsConstructor
public class SubscriptionService {

    private final SubscriptionRepository subscriptionRepository;
    private final BusinessUnlockRepository unlockRepository;
    private final CreditLedgerRepository ledgerRepository;
    private final PlanRepository planRepository;
    private final PlanService planService;
    private final BusinessRepository businessRepository;
    private final BusinessService businessService;
    private final UserRepository userRepository;
    private final ListingStatusService listingStatusService;
    private final PolicyEngine policyEngine;
    private final AuditService auditService;

    @Transactional
    public Map<String, Object> subscribe(AuthPrincipal principal, String planCode) {
        User user = requireUser(principal.id());
        if (user.getRole() != Role.RESEARCHER) {
            throw ApiException.forbidden("ROLE_NOT_ALLOWED", "Only researchers subscribe to research plans");
        }
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw ApiException.forbidden("ACCOUNT_NOT_ACTIVE",
                    "Your profile must be approved before subscribing");
        }
        Plan plan = planService.requireActivePlan(planCode, PlanAudience.RESEARCHER);
        Instant now = Instant.now();
        subscriptionRepository.findActiveForUpdate(user.getId(), SubscriptionStatus.ACTIVE, now)
                .ifPresent(existing -> {
                    throw ApiException.conflict("SUBSCRIPTION_EXISTS",
                            "You already have an active subscription");
                });
        // Clean up an ACTIVE row whose end date has passed but whose job has not run yet.
        for (Subscription stale : subscriptionRepository.findByUserIdAndStatus(
                user.getId(), SubscriptionStatus.ACTIVE)) {
            expire(stale, null, now);
        }

        int credits = plan.getCredits() == null ? 0 : plan.getCredits();
        Subscription subscription = new Subscription();
        subscription.setUserId(user.getId());
        subscription.setPlanId(plan.getId());
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setStartsAt(now);
        subscription.setEndsAt(addMonths(now, plan.getDurationMonths()));
        subscription.setCreditsGranted(credits);
        subscription.setCreditsRemaining(credits);
        subscription = subscriptionRepository.save(subscription);

        writeLedger(user.getId(), subscription, LedgerEntryType.GRANT, credits, credits,
                null, "Subscription activated: " + plan.getCode(), null);
        auditService.record(user.getId(), "SUBSCRIPTION_CREATED", "subscription",
                subscription.getId(), null, subscriptionMap(subscription));
        return subscriptionMap(subscription);
    }

    public Map<String, Object> mySubscription(AuthPrincipal principal) {
        Instant now = Instant.now();
        List<Subscription> subscriptions = subscriptionRepository
                .findByUserIdOrderByCreatedAtDesc(principal.id());
        Subscription active = subscriptions.stream()
                .filter(subscription -> subscription.getStatus() == SubscriptionStatus.ACTIVE
                        && subscription.getEndsAt().isAfter(now))
                .findFirst()
                .orElse(null);
        Subscription latest = active != null ? active
                : subscriptions.stream().findFirst().orElse(null);
        Map<String, Object> response;
        if (latest == null) {
            response = new LinkedHashMap<>();
            response.put("active", false);
            response.put("creditsRemaining", 0);
            response.put("creditsGranted", 0);
            response.put("unlockedCount", 0);
            response.put("subscription", null);
        } else {
            response = new LinkedHashMap<>();
            response.put("active", latest == active);
            response.put("creditsRemaining", active == null ? 0 : active.getCreditsRemaining());
            response.put("creditsGranted", active == null ? 0 : active.getCreditsGranted());
            response.put("unlockedCount", active == null ? 0
                    : unlockRepository.findActiveUnlocks(principal.id(),
                    SubscriptionStatus.ACTIVE, now).size());
            response.put("subscription", subscriptionMap(latest));
        }
        return response;
    }

    public PageResult<Map<String, Object>> ledger(AuthPrincipal principal, int page, int size) {
        Page<CreditLedgerEntry> result = ledgerRepository.findByUserIdOrderByCreatedAtDesc(
                principal.id(), PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
        return PageResult.of(result, this::ledgerMap);
    }

    @Transactional
    public Map<String, Object> unlock(AuthPrincipal principal, UUID businessId) {
        Instant now = Instant.now();
        Subscription subscription = subscriptionRepository
                .findActiveForUpdate(principal.id(), SubscriptionStatus.ACTIVE, now)
                .orElseThrow(() -> ApiException.forbidden("SUBSCRIPTION_REQUIRED",
                        "An active research subscription is required to unlock businesses"));
        Business business = businessRepository.findById(businessId)
                .orElseThrow(() -> ApiException.notFound("BUSINESS_NOT_LISTED", "Business not listed"));
        if (!listingStatusService.visibleToResearchers(business)) {
            throw ApiException.notFound("BUSINESS_NOT_LISTED", "Business is not currently listed");
        }
        Optional<BusinessUnlock> existing = unlockRepository
                .findBySubscriptionIdAndBusinessId(subscription.getId(), businessId);
        if (existing.isPresent()) {
            return businessService.detail(principal, businessId);
        }
        if (subscription.getCreditsRemaining() <= 0) {
            throw ApiException.forbidden("NO_CREDITS", "No credits remain in this subscription");
        }

        int balance = subscription.getCreditsRemaining() - 1;
        subscription.setCreditsRemaining(balance);
        subscriptionRepository.save(subscription);

        BusinessUnlock unlock = new BusinessUnlock();
        unlock.setUserId(principal.id());
        unlock.setBusinessId(businessId);
        unlock.setSubscriptionId(subscription.getId());
        unlockRepository.saveAndFlush(unlock);

        writeLedger(principal.id(), subscription, LedgerEntryType.SPEND, -1, balance,
                businessId, "Unlocked business " + business.getLegalName(), principal.id());
        auditService.record(principal.id(), "BUSINESS_UNLOCKED", "business", businessId, null,
                Map.of("subscriptionId", subscription.getId().toString(),
                        "creditsRemaining", balance));
        return businessService.detail(principal, businessId);
    }

    public List<Map<String, Object>> unlockedBusinesses(AuthPrincipal principal) {
        Instant now = Instant.now();
        List<BusinessUnlock> unlocks = unlockRepository.findActiveUnlocks(principal.id(),
                SubscriptionStatus.ACTIVE, now);
        if (unlocks.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = unlocks.stream().map(BusinessUnlock::getBusinessId).toList();
        Map<UUID, Business> businesses = new HashMap<>();
        businessRepository.findAllById(ids)
                .forEach(business -> businesses.put(business.getId(), business));
        List<Map<String, Object>> items = new ArrayList<>();
        for (BusinessUnlock unlock : unlocks) {
            Business business = businesses.get(unlock.getBusinessId());
            if (business == null || !listingStatusService.visibleToResearchers(business)) {
                continue;
            }
            Map<String, Object> item = policyEngine.filterOutput(businessService.map(business, false),
                    principal, "business", UnlockState.UNLOCKED);
            item.put("unlockedAt", unlock.getUnlockedAt());
            items.add(item);
        }
        return items;
    }

    public Map<String, Object> adminSubscriptions(UUID userId, int page, int size) {
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Map<String, Object> response = new LinkedHashMap<>();
        if (userId != null) {
            User user = requireUser(userId);
            Map<String, Object> userInfo = new LinkedHashMap<>();
            userInfo.put("id", user.getId());
            userInfo.put("email", user.getEmail());
            userInfo.put("fullName", user.getFullName());
            userInfo.put("role", user.getRole().apiValue());
            userInfo.put("status", user.getStatus().apiValue());
            response.put("user", userInfo);
            response.put("subscriptions", subscriptionRepository
                    .findByUserIdOrderByCreatedAtDesc(userId).stream()
                    .map(this::subscriptionMap).toList());
            Page<CreditLedgerEntry> ledgerPage = ledgerRepository
                    .findByUserIdOrderByCreatedAtDesc(userId, pageable);
            response.put("ledger", PageResult.of(ledgerPage, this::ledgerMap));
            response.put("unlockedBusinesses", unlockRepository.findActiveUnlocks(userId,
                            SubscriptionStatus.ACTIVE, Instant.now()).stream()
                    .map(BusinessUnlock::getBusinessId).toList());
            return response;
        }
        Page<Subscription> result = subscriptionRepository.findAll(pageable);
        response.put("items", result.getContent().stream().map(this::subscriptionMap).toList());
        response.put("page", result.getNumber());
        response.put("size", result.getSize());
        response.put("total", result.getTotalElements());
        response.put("totalPages", result.getTotalPages());
        return response;
    }

    @Transactional
    public Map<String, Object> adminGrantCredits(UUID subscriptionId, int amount, String reason,
                                                 AuthPrincipal admin) {
        if (amount == 0) {
            throw ApiException.badRequest("INVALID_AMOUNT", "The credit adjustment cannot be zero");
        }
        if (reason == null || reason.isBlank()) {
            throw ApiException.badRequest("REASON_REQUIRED", "A reason is required");
        }
        Subscription subscription = requireSubscriptionForUpdate(subscriptionId);
        if (subscription.getStatus() != SubscriptionStatus.ACTIVE) {
            throw ApiException.conflict("SUBSCRIPTION_NOT_ACTIVE",
                    "Credits can only be adjusted on an active subscription");
        }
        int balance = subscription.getCreditsRemaining() + amount;
        if (balance < 0) {
            throw ApiException.badRequest("INSUFFICIENT_CREDITS",
                    "The adjustment would leave a negative credit balance");
        }
        int before = subscription.getCreditsRemaining();
        subscription.setCreditsRemaining(balance);
        subscriptionRepository.save(subscription);
        writeLedger(subscription.getUserId(), subscription, LedgerEntryType.ADMIN_ADJUST, amount,
                balance, null, reason.trim(), admin.id());
        Map<String, Object> audit = subscriptionMap(subscription);
        audit.put("adjustment", amount);
        audit.put("reason", reason.trim());
        audit.put("balanceBefore", before);
        auditService.record(admin.id(), "SUBSCRIPTION_CREDITS_ADJUSTED", "subscription",
                subscriptionId, null, audit);
        return audit;
    }

    @Transactional
    public Map<String, Object> adminExtend(UUID subscriptionId, int months, String reason,
                                           AuthPrincipal admin) {
        if (months < 1 || months > 120) {
            throw ApiException.badRequest("INVALID_DURATION", "months must be between 1 and 120");
        }
        Subscription subscription = requireSubscriptionForUpdate(subscriptionId);
        if (subscription.getStatus() != SubscriptionStatus.ACTIVE) {
            throw ApiException.conflict("SUBSCRIPTION_NOT_ACTIVE",
                    "Only an active subscription can be extended");
        }
        Map<String, Object> before = subscriptionMap(subscription);
        subscription.setEndsAt(addMonths(subscription.getEndsAt(), months));
        subscriptionRepository.save(subscription);
        Map<String, Object> after = subscriptionMap(subscription);
        after.put("reason", reason);
        auditService.record(admin.id(), "SUBSCRIPTION_EXTENDED", "subscription", subscriptionId,
                before, after);
        return after;
    }

    @Transactional
    public Map<String, Object> adminCancel(UUID subscriptionId, String reason,
                                           AuthPrincipal admin) {
        Subscription subscription = requireSubscriptionForUpdate(subscriptionId);
        if (subscription.getStatus() != SubscriptionStatus.ACTIVE) {
            throw ApiException.conflict("SUBSCRIPTION_NOT_ACTIVE",
                    "Only an active subscription can be cancelled");
        }
        Map<String, Object> before = subscriptionMap(subscription);
        int remaining = subscription.getCreditsRemaining();
        subscription.setStatus(SubscriptionStatus.CANCELLED);
        subscription.setCreditsRemaining(0);
        subscription.setCancelledAt(Instant.now());
        subscriptionRepository.save(subscription);
        if (remaining > 0) {
            writeLedger(subscription.getUserId(), subscription, LedgerEntryType.EXPIRE,
                    -remaining, 0, null, "Subscription cancelled with unused credits", admin.id());
        }
        Map<String, Object> after = subscriptionMap(subscription);
        after.put("reason", reason);
        auditService.record(admin.id(), "SUBSCRIPTION_CANCELLED", "subscription", subscriptionId,
                before, after);
        return after;
    }

    @Transactional
    public int expireOverdue() {
        Instant now = Instant.now();
        List<Subscription> overdue = subscriptionRepository.findByStatusAndEndsAtBefore(
                SubscriptionStatus.ACTIVE, now);
        for (Subscription subscription : overdue) {
            expire(subscription, null, now);
        }
        return overdue.size();
    }

    private void expire(Subscription subscription, UUID actor, Instant now) {
        int remaining = subscription.getCreditsRemaining();
        subscription.setStatus(SubscriptionStatus.EXPIRED);
        subscription.setCreditsRemaining(0);
        subscriptionRepository.save(subscription);
        if (remaining > 0) {
            writeLedger(subscription.getUserId(), subscription, LedgerEntryType.EXPIRE,
                    -remaining, 0, null, "Subscription expired with unused credits", actor);
        }
        auditService.record(actor, "SUBSCRIPTION_EXPIRED", "subscription", subscription.getId(),
                null, subscriptionMap(subscription));
    }

    private void writeLedger(UUID userId, Subscription subscription, LedgerEntryType type,
                             int amount, int balanceAfter, UUID businessId, String reason,
                             UUID createdBy) {
        CreditLedgerEntry entry = new CreditLedgerEntry();
        entry.setUserId(userId);
        entry.setSubscriptionId(subscription == null ? null : subscription.getId());
        entry.setEntryType(type);
        entry.setAmount(amount);
        entry.setBusinessId(businessId);
        entry.setBalanceAfter(balanceAfter);
        entry.setReason(reason);
        entry.setCreatedBy(createdBy);
        ledgerRepository.save(entry);
    }

    private Subscription requireSubscriptionForUpdate(UUID id) {
        return subscriptionRepository.findByIdForUpdate(id)
                .orElseThrow(() -> ApiException.notFound("SUBSCRIPTION_NOT_FOUND",
                        "Subscription not found"));
    }

    public Map<String, Object> subscriptionMap(Subscription subscription) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", subscription.getId());
        map.put("userId", subscription.getUserId());
        map.put("planId", subscription.getPlanId());
        planRepository.findById(subscription.getPlanId())
                .ifPresent(plan -> map.put("plan", planService.toMap(plan)));
        map.put("status", subscription.getStatus().name().toLowerCase(Locale.ROOT));
        map.put("startsAt", subscription.getStartsAt());
        map.put("endsAt", subscription.getEndsAt());
        map.put("creditsGranted", subscription.getCreditsGranted());
        map.put("creditsRemaining", subscription.getCreditsRemaining());
        map.put("active", subscription.getStatus() == SubscriptionStatus.ACTIVE
                && subscription.getEndsAt().isAfter(Instant.now()));
        map.put("cancelledAt", subscription.getCancelledAt());
        map.put("createdAt", subscription.getCreatedAt());
        return map;
    }

    public Map<String, Object> ledgerMap(CreditLedgerEntry entry) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", entry.getId());
        map.put("userId", entry.getUserId());
        map.put("subscriptionId", entry.getSubscriptionId());
        map.put("entryType", entry.getEntryType().name().toLowerCase(Locale.ROOT));
        map.put("amount", entry.getAmount());
        map.put("businessId", entry.getBusinessId());
        map.put("balanceAfter", entry.getBalanceAfter());
        map.put("reason", entry.getReason());
        map.put("createdBy", entry.getCreatedBy());
        map.put("createdAt", entry.getCreatedAt());
        return map;
    }

    private User requireUser(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "User not found"));
    }

    private Instant addMonths(Instant from, int months) {
        return from.atZone(ZoneOffset.UTC).plusMonths(months).toInstant();
    }
}
