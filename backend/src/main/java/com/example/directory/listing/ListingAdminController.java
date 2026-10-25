package com.example.directory.listing;

import com.example.directory.auth.AuthPrincipal;
import com.example.directory.common.ApiException;
import com.example.directory.common.PageResult;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class ListingAdminController {

    private final ListingService listingService;

    @GetMapping("/listings")
    @PreAuthorize("hasAuthority('listing:manage')")
    public PageResult<Map<String, Object>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return listingService.adminList(status, page, size);
    }

    @PostMapping("/businesses/{id}/listing/list")
    @PreAuthorize("hasAuthority('listing:manage')")
    public Map<String, Object> listBusiness(@PathVariable UUID id,
                                            @AuthenticationPrincipal AuthPrincipal admin) {
        return listingService.setAdminListing(id, true, admin);
    }

    @PostMapping("/businesses/{id}/listing/unlist")
    @PreAuthorize("hasAuthority('listing:manage')")
    public Map<String, Object> unlistBusiness(@PathVariable UUID id,
                                              @AuthenticationPrincipal AuthPrincipal admin) {
        return listingService.setAdminListing(id, false, admin);
    }

    @PostMapping("/businesses/{id}/listing/extend")
    @PreAuthorize("hasAuthority('listing:manage')")
    public Map<String, Object> extend(@PathVariable UUID id,
                                      @RequestBody Map<String, Object> payload,
                                      @AuthenticationPrincipal AuthPrincipal admin) {
        int months = intValue(payload, "months", 1);
        return listingService.adminExtend(id, months, admin, text(payload.get("reason")));
    }

    @PostMapping("/businesses/{id}/listing/cancel")
    @PreAuthorize("hasAuthority('listing:manage')")
    public Map<String, Object> cancel(@PathVariable UUID id,
                                      @RequestBody(required = false) Map<String, Object> payload,
                                      @AuthenticationPrincipal AuthPrincipal admin) {
        return listingService.adminCancel(id, admin,
                payload == null ? null : text(payload.get("reason")));
    }

    private int intValue(Map<String, Object> payload, String field, int fallback) {
        Object value = payload == null ? null : payload.get(field);
        if (value == null || value.toString().isBlank()) {
            return fallback;
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
