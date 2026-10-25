package com.example.directory.user;

import com.example.directory.audit.AuditLog;
import com.example.directory.audit.AuditLogRepository;
import com.example.directory.business.Business;
import com.example.directory.business.BusinessRepository;
import com.example.directory.document.DocumentRepository;
import com.example.directory.document.DocumentStatus;
import com.example.directory.listing.ListingStatus;
import com.example.directory.listing.ListingStatusService;
import com.example.directory.subscription.CreditLedgerRepository;
import com.example.directory.subscription.LedgerEntryType;
import com.example.directory.subscription.SubscriptionRepository;
import com.example.directory.subscription.SubscriptionStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

@RestController
@RequestMapping("/api/v1/admin/dashboard")
@RequiredArgsConstructor
public class AdminDashboardController {

    private final UserRepository userRepository;
    private final DocumentRepository documentRepository;
    private final BusinessRepository businessRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final CreditLedgerRepository ledgerRepository;
    private final ListingStatusService listingStatusService;
    private final AuditLogRepository auditLogRepository;

    @GetMapping
    @PreAuthorize("hasAuthority('dashboard:read')")
    public Map<String, Object> dashboard() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("pendingUsers", userRepository.countByStatus(UserStatus.PENDING_REVIEW));
        response.put("pendingDocuments", documentRepository.countByStatus(DocumentStatus.PENDING));

        Map<String, Object> activeUsers = new LinkedHashMap<>();
        for (Role role : Role.values()) {
            activeUsers.put(role.apiValue(),
                    userRepository.countByRoleAndStatus(role, UserStatus.ACTIVE));
        }
        response.put("activeUsersByRole", activeUsers);
        response.put("totalUsers", userRepository.count());
        response.put("activeSubscriptions",
                subscriptionRepository.countByStatus(SubscriptionStatus.ACTIVE));

        List<Business> businesses = businessRepository.findAll();
        long listed = businesses.stream()
                .filter(business -> listingStatusService.statusOf(business) == ListingStatus.LISTED)
                .count();
        Instant soon = Instant.now().plus(Duration.ofDays(30));
        long expiring = businesses.stream()
                .filter(business -> listingStatusService.statusOf(business) == ListingStatus.LISTED
                        && business.getListedUntil() != null
                        && business.getListedUntil().isBefore(soon))
                .count();
        response.put("listedBusinesses", listed);
        response.put("unlistedBusinesses", businesses.size() - listed);
        response.put("listingsExpiringIn30Days", expiring);

        Instant monthStart = LocalDate.now(ZoneOffset.UTC).withDayOfMonth(1)
                .atStartOfDay().toInstant(ZoneOffset.UTC);
        response.put("creditsSpentThisMonth",
                ledgerRepository.sumSpentSince(LedgerEntryType.SPEND, monthStart));

        List<Map<String, Object>> recent = auditLogRepository.findAll(
                        PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "createdAt")))
                .getContent().stream().map(this::auditMap).toList();
        response.put("recentAuditEvents", recent);
        return response;
    }

    private Map<String, Object> auditMap(AuditLog entry) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", entry.getId());
        map.put("actorUserId", entry.getActorUserId());
        map.put("action", entry.getAction());
        map.put("resourceType", entry.getResourceType());
        map.put("resourceId", entry.getResourceId());
        map.put("createdAt", entry.getCreatedAt());
        return map;
    }
}
