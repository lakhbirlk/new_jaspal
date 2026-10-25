package com.example.directory.subscription;

import com.example.directory.audit.AuditService;
import com.example.directory.auth.AuthPrincipal;
import com.example.directory.common.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
public class PlanService {

    private final PlanRepository repository;
    private final AuditService auditService;

    public List<Map<String, Object>> publicPlans(String audienceValue) {
        PlanAudience audience = parseAudience(audienceValue);
        List<Plan> plans = audience == null
                ? repository.findAllByOrderByAudienceAscPriceAmountAsc()
                : repository.findByAudienceAndActiveTrueOrderByPriceAmountAsc(audience);
        return plans.stream()
                .filter(Plan::isActive)
                .map(this::toMap)
                .toList();
    }

    public List<Map<String, Object>> researcherPlans() {
        return repository.findByAudienceAndActiveTrueOrderByPriceAmountAsc(PlanAudience.RESEARCHER)
                .stream().map(this::toMap).toList();
    }

    public List<Map<String, Object>> businessPlans() {
        return repository.findByAudienceAndActiveTrueOrderByPriceAmountAsc(PlanAudience.BUSINESS)
                .stream().map(this::toMap).toList();
    }

    public List<Map<String, Object>> adminList() {
        return repository.findAllByOrderByAudienceAscPriceAmountAsc().stream()
                .map(this::toMap).toList();
    }

    public Plan requireActivePlan(String code, PlanAudience audience) {
        Plan plan = repository.findByCodeIgnoreCase(code == null ? "" : code.trim())
                .orElseThrow(() -> ApiException.notFound("PLAN_NOT_FOUND", "Plan not found"));
        if (!plan.isActive()) {
            throw ApiException.conflict("PLAN_INACTIVE", "This plan is no longer available");
        }
        if (plan.getAudience() != audience) {
            throw ApiException.badRequest("PLAN_AUDIENCE_MISMATCH",
                    "This plan is not available for this role");
        }
        return plan;
    }

    @Transactional
    public Map<String, Object> create(Map<String, Object> payload, AuthPrincipal admin) {
        String code = requireText(payload, "code").toUpperCase(Locale.ROOT);
        if (repository.findByCodeIgnoreCase(code).isPresent()) {
            throw ApiException.conflict("PLAN_CODE_EXISTS", "A plan with this code already exists");
        }
        Plan plan = new Plan();
        plan.setCode(code);
        apply(plan, payload, true);
        Plan saved = repository.save(plan);
        auditService.record(admin.id(), "PLAN_CREATED", "plan", saved.getId(), null, toMap(saved));
        return toMap(saved);
    }

    @Transactional
    public Map<String, Object> update(UUID id, Map<String, Object> payload, AuthPrincipal admin) {
        Plan plan = repository.findById(id)
                .orElseThrow(() -> ApiException.notFound("PLAN_NOT_FOUND", "Plan not found"));
        Map<String, Object> before = toMap(plan);
        if (payload.containsKey("code")) {
            String code = requireText(payload, "code").toUpperCase(Locale.ROOT);
            repository.findByCodeIgnoreCase(code).ifPresent(existing -> {
                if (!existing.getId().equals(id)) {
                    throw ApiException.conflict("PLAN_CODE_EXISTS",
                            "A plan with this code already exists");
                }
            });
            plan.setCode(code);
        }
        apply(plan, payload, false);
        Plan saved = repository.save(plan);
        auditService.record(admin.id(), "PLAN_UPDATED", "plan", id, before, toMap(saved));
        return toMap(saved);
    }

    private void apply(Plan plan, Map<String, Object> payload, boolean creating) {
        if (creating || payload.containsKey("name")) {
            plan.setName(requireText(payload, "name"));
        }
        if (creating || payload.containsKey("audience")) {
            PlanAudience audience = parseAudience(String.valueOf(payload.get("audience")));
            if (audience == null) {
                throw ApiException.badRequest("INVALID_AUDIENCE",
                        "audience must be researcher or business");
            }
            plan.setAudience(audience);
        }
        if (payload.containsKey("credits")) {
            plan.setCredits(optionalInteger(payload.get("credits"), "credits"));
        }
        if (creating || payload.containsKey("durationMonths")) {
            Integer months = optionalInteger(payload.get("durationMonths"), "durationMonths");
            if (months == null || months < 1 || months > 120) {
                throw ApiException.badRequest("INVALID_DURATION",
                        "durationMonths must be between 1 and 120");
            }
            plan.setDurationMonths(months);
        }
        if (payload.containsKey("priceAmount")) {
            plan.setPriceAmount(optionalDecimal(payload.get("priceAmount"), "priceAmount"));
        }
        if (payload.containsKey("currency")) {
            String currency = optionalText(payload.get("currency"));
            plan.setCurrency(currency == null ? "INR" : currency.toUpperCase(Locale.ROOT));
        }
        if (payload.containsKey("active")) {
            plan.setActive(Boolean.parseBoolean(String.valueOf(payload.get("active"))));
        }
        if (plan.getAudience() == PlanAudience.RESEARCHER) {
            if (plan.getCredits() == null || plan.getCredits() < 1) {
                throw ApiException.badRequest("INVALID_CREDITS",
                        "Researcher plans need at least one credit");
            }
        }
    }

    private PlanAudience parseAudience(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return PlanAudience.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            throw ApiException.badRequest("INVALID_AUDIENCE",
                    "audience must be researcher or business");
        }
    }

    private String requireText(Map<String, Object> payload, String field) {
        String text = optionalText(payload.get(field));
        if (text == null) {
            throw ApiException.badRequest("REQUIRED_FIELD", field + " is required");
        }
        return text;
    }

    private String optionalText(Object value) {
        if (value == null) return null;
        String text = value.toString().trim();
        return text.isEmpty() ? null : text;
    }

    private Integer optionalInteger(Object value, String field) {
        if (value == null || value.toString().isBlank()) return null;
        try {
            return Integer.valueOf(value.toString());
        } catch (NumberFormatException ex) {
            throw ApiException.badRequest("INVALID_NUMBER", field + " must be an integer");
        }
    }

    private BigDecimal optionalDecimal(Object value, String field) {
        if (value == null || value.toString().isBlank()) return BigDecimal.ZERO;
        try {
            BigDecimal number = new BigDecimal(value.toString());
            if (number.signum() < 0) throw new NumberFormatException();
            return number;
        } catch (NumberFormatException ex) {
            throw ApiException.badRequest("INVALID_NUMBER", field + " must be a positive number");
        }
    }

    public Map<String, Object> toMap(Plan plan) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", plan.getId());
        map.put("code", plan.getCode());
        map.put("name", plan.getName());
        map.put("audience", plan.getAudience().name().toLowerCase(Locale.ROOT));
        map.put("credits", plan.getCredits());
        map.put("durationMonths", plan.getDurationMonths());
        map.put("priceAmount", plan.getPriceAmount());
        map.put("currency", plan.getCurrency());
        map.put("active", plan.isActive());
        map.put("createdAt", plan.getCreatedAt());
        map.put("updatedAt", plan.getUpdatedAt());
        return map;
    }
}
