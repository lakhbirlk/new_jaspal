package com.example.directory.search;

import com.example.directory.auth.AuthPrincipal;
import com.example.directory.business.Business;
import com.example.directory.business.BusinessRepository;
import com.example.directory.business.BusinessService;
import com.example.directory.common.PageResult;
import com.example.directory.policy.PolicyEngine;
import com.example.directory.policy.UnlockState;
import com.example.directory.user.Role;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
public class SearchService {

    private final BusinessRepository businessRepository;
    private final BusinessService businessService;
    private final PolicyEngine policyEngine;
    private final ResearchAccessLogRepository accessLogRepository;

    @Transactional
    public PageResult<Map<String, Object>> search(AuthPrincipal principal, String q,
                                                  String industry, String city, String state,
                                                  java.math.BigDecimal minRevenue,
                                                  java.math.BigDecimal maxRevenue,
                                                  int page, int size) {
        String query = normalize(q);
        String industryFilter = normalize(industry);
        String cityFilter = normalize(city);
        String stateFilter = normalize(state);
        Page<Business> result = businessRepository.searchListed(query, industryFilter, cityFilter,
                stateFilter, minRevenue, maxRevenue,
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50)));

        List<UUID> ids = result.getContent().stream().map(Business::getId).toList();
        Set<UUID> unlocked = principal.role() == Role.RESEARCHER
                ? policyEngine.unlockedBusinessIds(principal.id(), ids) : Set.of();

        List<Map<String, Object>> items = new ArrayList<>();
        for (Business business : result.getContent()) {
            UnlockState unlockState = principal.role() == Role.RESEARCHER
                    ? (unlocked.contains(business.getId()) ? UnlockState.UNLOCKED : UnlockState.LOCKED)
                    : UnlockState.ANY;
            Map<String, Object> filtered = policyEngine.filterOutput(
                    businessService.map(business, false), principal, "business", unlockState);
            filtered.put("public_code", businessService.publicCode(business.getId()));
            items.add(filtered);
        }

        if (principal.role() == Role.RESEARCHER) {
            ResearchAccessLog log = new ResearchAccessLog();
            log.setResearcherUserId(principal.id());
            log.setQuery(query == null ? "" : query);
            accessLogRepository.save(log);
        }
        return PageResult.of(result, items);
    }

    /** Filter options for the company database: the industries and states present in listings. */
    public Map<String, Object> facets() {
        Map<String, Object> facets = new LinkedHashMap<>();
        facets.put("industries", businessRepository.findListedIndustries());
        facets.put("states", businessRepository.findListedStates());
        return facets;
    }

    private String normalize(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }
}
