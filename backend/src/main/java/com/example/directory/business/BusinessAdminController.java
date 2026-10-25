package com.example.directory.business;

import com.example.directory.audit.AuditService;
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
@RequestMapping("/api/v1/admin/businesses")
@RequiredArgsConstructor
public class BusinessAdminController {

    private final BusinessService businessService;
    private final BusinessRepository businessRepository;

    @GetMapping
    @PreAuthorize("hasAuthority('business:read')")
    public PageResult<Map<String, Object>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String verificationStatus,
            @RequestParam(required = false) String listingStatus,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return businessService.adminList(q, verificationStatus, listingStatus, page, size, principal);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('business:read')")
    public Map<String, Object> detail(@PathVariable UUID id,
                                      @AuthenticationPrincipal AuthPrincipal principal) {
        return businessService.adminDetail(id, principal);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAuthority('business:update')")
    public Map<String, Object> update(@PathVariable UUID id,
                                      @RequestBody Map<String, Object> payload,
                                      @AuthenticationPrincipal AuthPrincipal principal) {
        return businessService.adminUpdate(id, payload, principal);
    }
}
