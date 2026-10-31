package com.example.directory.subscription;

import com.example.directory.auth.AuthPrincipal;
import com.example.directory.common.ApiException;
import com.example.directory.common.PageResult;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class ResearcherController {

    private final SubscriptionService subscriptionService;

    @PostMapping("/subscriptions")
    @PreAuthorize("hasAuthority('subscription:manage')")
    public Map<String, Object> subscribe(@RequestBody Map<String, Object> payload,
                                         @AuthenticationPrincipal AuthPrincipal principal) {
        Object code = payload == null ? null : payload.get("planCode");
        if (code == null || code.toString().isBlank()) {
            throw ApiException.badRequest("PLAN_CODE_REQUIRED", "planCode is required");
        }
        return subscriptionService.startCheckout(principal, code.toString().trim());
    }

    @GetMapping("/subscriptions/me")
    @PreAuthorize("hasAuthority('subscription:manage')")
    public Map<String, Object> mySubscription(@AuthenticationPrincipal AuthPrincipal principal) {
        return subscriptionService.mySubscription(principal);
    }

    @GetMapping("/credits/ledger")
    @PreAuthorize("hasAuthority('subscription:manage')")
    public PageResult<Map<String, Object>> ledger(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return subscriptionService.ledger(principal, page, size);
    }

    @PostMapping("/businesses/{id}/unlock")
    @PreAuthorize("hasAuthority('business:unlock')")
    public Map<String, Object> unlock(@PathVariable UUID id,
                                      @AuthenticationPrincipal AuthPrincipal principal) {
        return subscriptionService.unlock(principal, id);
    }

    @GetMapping("/businesses/unlocked")
    @PreAuthorize("hasAuthority('business:unlock')")
    public List<Map<String, Object>> unlocked(
            @AuthenticationPrincipal AuthPrincipal principal) {
        return subscriptionService.unlockedBusinesses(principal);
    }
}
