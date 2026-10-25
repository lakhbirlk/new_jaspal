package com.example.directory.subscription;

import com.example.directory.auth.AuthPrincipal;
import com.example.directory.common.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/subscriptions")
@RequiredArgsConstructor
public class SubscriptionAdminController {

    private final SubscriptionService subscriptionService;

    @GetMapping
    @PreAuthorize("hasAuthority('subscription:manage')")
    public Map<String, Object> list(
            @RequestParam(required = false) UUID userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return subscriptionService.adminSubscriptions(userId, page, size);
    }

    @PostMapping("/{id}/credits")
    @PreAuthorize("hasAuthority('subscription:manage')")
    public Map<String, Object> adjustCredits(@PathVariable UUID id,
                                             @RequestBody Map<String, Object> payload,
                                             @AuthenticationPrincipal AuthPrincipal admin) {
        int amount = integer(payload, "amount");
        return subscriptionService.adminGrantCredits(id, amount,
                text(payload.get("reason")), admin);
    }

    @PostMapping("/{id}/extend")
    @PreAuthorize("hasAuthority('subscription:manage')")
    public Map<String, Object> extend(@PathVariable UUID id,
                                      @RequestBody Map<String, Object> payload,
                                      @AuthenticationPrincipal AuthPrincipal admin) {
        int months = integer(payload, "months");
        return subscriptionService.adminExtend(id, months, text(payload.get("reason")), admin);
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('subscription:manage')")
    public Map<String, Object> cancel(@PathVariable UUID id,
                                      @RequestBody(required = false) Map<String, Object> payload,
                                      @AuthenticationPrincipal AuthPrincipal admin) {
        return subscriptionService.adminCancel(id,
                payload == null ? null : text(payload.get("reason")), admin);
    }

    private int integer(Map<String, Object> payload, String field) {
        Object value = payload == null ? null : payload.get(field);
        if (value == null || value.toString().isBlank()) {
            throw ApiException.badRequest("REQUIRED_FIELD", field + " is required");
        }
        try {
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException ex) {
            throw ApiException.badRequest("INVALID_NUMBER", field + " must be an integer");
        }
    }

    private String text(Object value) {
        if (value == null) return null;
        String text = value.toString().trim();
        return text.isEmpty() ? null : text;
    }
}
