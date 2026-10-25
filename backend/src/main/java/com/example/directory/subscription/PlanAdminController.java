package com.example.directory.subscription;

import com.example.directory.auth.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/plans")
@RequiredArgsConstructor
public class PlanAdminController {

    private final PlanService planService;

    @GetMapping
    @PreAuthorize("hasAuthority('plan:manage')")
    public List<Map<String, Object>> list() {
        return planService.adminList();
    }

    @PostMapping
    @PreAuthorize("hasAuthority('plan:manage')")
    public Map<String, Object> create(@RequestBody Map<String, Object> payload,
                                      @AuthenticationPrincipal AuthPrincipal admin) {
        return planService.create(payload, admin);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAuthority('plan:manage')")
    public Map<String, Object> update(@PathVariable UUID id,
                                      @RequestBody Map<String, Object> payload,
                                      @AuthenticationPrincipal AuthPrincipal admin) {
        return planService.update(id, payload, admin);
    }
}
