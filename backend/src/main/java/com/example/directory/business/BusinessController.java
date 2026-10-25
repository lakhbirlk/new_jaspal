package com.example.directory.business;

import com.example.directory.auth.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class BusinessController {

    private final BusinessService businessService;

    @GetMapping("/my/business")
    @PreAuthorize("hasAuthority('business:read')")
    public Map<String, Object> myBusiness(@AuthenticationPrincipal AuthPrincipal principal) {
        return businessService.myBusiness(principal);
    }

    @PatchMapping("/my/business")
    @PreAuthorize("hasAuthority('business:update')")
    public Map<String, Object> updateMyBusiness(@AuthenticationPrincipal AuthPrincipal principal,
                                                @RequestBody Map<String, Object> payload) {
        return businessService.updateMyBusiness(principal, payload);
    }

    @GetMapping("/businesses/{id}")
    @PreAuthorize("hasAuthority('business:read')")
    public Map<String, Object> detail(@AuthenticationPrincipal AuthPrincipal principal,
                                      @PathVariable UUID id) {
        return businessService.detail(principal, id);
    }
}
