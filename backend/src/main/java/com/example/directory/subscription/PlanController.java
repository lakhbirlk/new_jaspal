package com.example.directory.subscription;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class PlanController {

    private final PlanService planService;

    @GetMapping("/public/plans")
    public List<Map<String, Object>> publicPlans(@RequestParam(required = false) String audience) {
        return planService.publicPlans(audience);
    }

    @GetMapping("/plans")
    @PreAuthorize("hasAuthority('plan:read')")
    public List<Map<String, Object>> researcherPlans() {
        return planService.researcherPlans();
    }

    @GetMapping("/listing-plans")
    @PreAuthorize("hasAuthority('plan:read')")
    public List<Map<String, Object>> businessPlans() {
        return planService.businessPlans();
    }
}
