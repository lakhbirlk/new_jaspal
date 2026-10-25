package com.example.directory.listing;

import com.example.directory.auth.AuthPrincipal;
import com.example.directory.common.PageResult;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class ListingController {

    private final ListingService listingService;

    @PostMapping("/my/listing")
    @PreAuthorize("hasAuthority('listing:manage')")
    public Map<String, Object> purchase(@RequestBody Map<String, Object> payload,
                                        @AuthenticationPrincipal AuthPrincipal principal) {
        Object code = payload == null ? null : payload.get("planCode");
        if (code == null || code.toString().isBlank()) {
            throw com.example.directory.common.ApiException.badRequest("PLAN_CODE_REQUIRED",
                    "planCode is required");
        }
        return listingService.purchase(principal, code.toString().trim());
    }

    @GetMapping("/my/listing")
    @PreAuthorize("hasAuthority('listing:manage')")
    public Map<String, Object> myListing(@AuthenticationPrincipal AuthPrincipal principal) {
        return listingService.myListing(principal);
    }
}
