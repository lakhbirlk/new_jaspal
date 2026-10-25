package com.example.directory.audit;

import com.example.directory.common.PageResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/audit-logs")
@RequiredArgsConstructor
public class AuditController {

    private final AuditLogRepository repository;
    private final ObjectMapper objectMapper;

    @GetMapping
    @PreAuthorize("hasAuthority('audit:read')")
    public PageResult<Map<String, Object>> list(
            @RequestParam(required = false) UUID actor,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) UUID resourceId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        var result = repository.findAll(specification(actor, action, resourceType, resourceId, from, to),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 200),
                        Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResult.of(result, this::toMap);
    }

    @GetMapping("/export")
    @PreAuthorize("hasAuthority('audit:read')")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) UUID actor,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) UUID resourceId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        var entries = repository.findAll(specification(actor, action, resourceType, resourceId, from, to),
                PageRequest.of(0, 10000, Sort.by(Sort.Direction.DESC, "createdAt"))).getContent();
        StringBuilder csv = new StringBuilder("id,created_at,actor_user_id,action,resource_type,resource_id,ip\n");
        for (AuditLog entry : entries) {
            csv.append(csv(entry.getId())).append(',')
                    .append(csv(entry.getCreatedAt())).append(',')
                    .append(csv(entry.getActorUserId())).append(',')
                    .append(csv(entry.getAction())).append(',')
                    .append(csv(entry.getResourceType())).append(',')
                    .append(csv(entry.getResourceId())).append(',')
                    .append(csv(entry.getIp())).append('\n');
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"audit-log.csv\"")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    private Specification<AuditLog> specification(UUID actor, String action, String resourceType,
                                                  UUID resourceId, Instant from, Instant to) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (actor != null) predicates.add(cb.equal(root.get("actorUserId"), actor));
            if (action != null && !action.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("action")), "%" + action.toLowerCase() + "%"));
            }
            if (resourceType != null && !resourceType.isBlank()) {
                predicates.add(cb.equal(root.get("resourceType"), resourceType));
            }
            if (resourceId != null) predicates.add(cb.equal(root.get("resourceId"), resourceId));
            if (from != null) predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from));
            if (to != null) predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), to));
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private Map<String, Object> toMap(AuditLog entry) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", entry.getId());
        map.put("actorUserId", entry.getActorUserId());
        map.put("action", entry.getAction());
        map.put("resourceType", entry.getResourceType());
        map.put("resourceId", entry.getResourceId());
        map.put("before", parse(entry.getBeforeState()));
        map.put("after", parse(entry.getAfterState()));
        map.put("ip", entry.getIp());
        map.put("userAgent", entry.getUserAgent());
        map.put("createdAt", entry.getCreatedAt());
        return map;
    }

    private JsonNode parse(String json) {
        if (json == null) return null;
        try {
            return objectMapper.readTree(json);
        } catch (Exception ex) {
            return null;
        }
    }

    private String csv(Object value) {
        if (value == null) return "";
        String text = value.toString().replace("\"", "\"\"");
        return "\"" + text + "\"";
    }
}
