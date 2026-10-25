package com.example.directory.search;

import com.example.directory.auth.AuthPrincipal;
import com.example.directory.common.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/saved-searches")
@RequiredArgsConstructor
public class SavedSearchController {

    private final SavedSearchService service;

    @PostMapping
    @PreAuthorize("hasAuthority('saved_search:manage')")
    public Map<String, Object> create(@RequestBody Map<String, Object> payload,
                                      @AuthenticationPrincipal AuthPrincipal principal) {
        Object name = payload == null ? null : payload.get("name");
        Object query = payload == null ? null : payload.get("query");
        if (!(query instanceof Map<?, ?> queryMap)) {
            throw ApiException.badRequest("QUERY_REQUIRED", "query must be an object");
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> typedQuery = (Map<String, Object>) queryMap;
        return service.create(principal.id(), name == null ? null : name.toString(), typedQuery);
    }

    @GetMapping
    @PreAuthorize("hasAuthority('saved_search:manage')")
    public List<Map<String, Object>> list(@AuthenticationPrincipal AuthPrincipal principal) {
        return service.list(principal.id());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('saved_search:manage')")
    public Map<String, Object> delete(@PathVariable UUID id,
                                      @AuthenticationPrincipal AuthPrincipal principal) {
        service.delete(id, principal.id());
        return Map.of("deleted", true);
    }
}
