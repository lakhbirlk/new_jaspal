package com.example.directory.search;

import com.example.directory.common.ApiException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SavedSearchService {

    private final SavedSearchRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional
    public Map<String, Object> create(UUID userId, String name, Map<String, Object> query) {
        if (name == null || name.isBlank()) {
            throw ApiException.badRequest("NAME_REQUIRED", "A name is required");
        }
        String trimmed = name.trim();
        if (trimmed.length() > 120) {
            throw ApiException.badRequest("NAME_TOO_LONG", "The name must be 120 characters or fewer");
        }
        if (query == null || query.isEmpty()) {
            throw ApiException.badRequest("QUERY_REQUIRED", "A search query is required");
        }
        SavedSearch saved = new SavedSearch();
        saved.setUserId(userId);
        saved.setName(trimmed);
        try {
            saved.setQueryJson(objectMapper.writeValueAsString(query));
        } catch (Exception ex) {
            throw ApiException.badRequest("QUERY_INVALID", "The query could not be saved");
        }
        saved = repository.save(saved);
        return toMap(saved);
    }

    public List<Map<String, Object>> list(UUID userId) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toMap).toList();
    }

    @Transactional
    public void delete(UUID id, UUID userId) {
        SavedSearch saved = repository.findById(id)
                .filter(item -> item.getUserId().equals(userId))
                .orElseThrow(() -> ApiException.notFound("SAVED_SEARCH_NOT_FOUND",
                        "Saved search not found"));
        repository.delete(saved);
    }

    private Map<String, Object> toMap(SavedSearch saved) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", saved.getId());
        map.put("name", saved.getName());
        map.put("query", parse(saved.getQueryJson()));
        map.put("createdAt", saved.getCreatedAt());
        return map;
    }

    private Object parse(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() { });
        } catch (Exception ex) {
            return json;
        }
    }
}
