package com.example.directory.business;

import com.example.directory.audit.AuditService;
import com.example.directory.auth.AuthPrincipal;
import com.example.directory.common.ApiException;
import com.example.directory.common.PageResult;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/audit/businesses")
@RequiredArgsConstructor
public class BusinessAuditController {

    private final BusinessService businessService;
    private final BusinessRepository businessRepository;
    private final AuditService auditService;

    @GetMapping
    @PreAuthorize("hasAuthority('business:read')")
    public PageResult<Map<String, Object>> list(
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal AuthPrincipal principal) {
        return businessService.auditorList(q, page, size, principal);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('business:read')")
    public Map<String, Object> detail(@PathVariable UUID id,
                                      @AuthenticationPrincipal AuthPrincipal principal) {
        return businessService.detail(principal, id);
    }

    @PostMapping("/{id}/notes")
    @PreAuthorize("hasAuthority('audit:note')")
    public Map<String, Object> addNote(@PathVariable UUID id,
                                       @RequestBody Map<String, Object> payload,
                                       @AuthenticationPrincipal AuthPrincipal principal) {
        if (!businessRepository.existsById(id)) {
            throw ApiException.notFound("BUSINESS_NOT_FOUND", "Business not found");
        }
        Object value = payload == null ? null : payload.get("note");
        if (value == null || value.toString().isBlank()) {
            throw ApiException.badRequest("NOTE_REQUIRED", "A note is required");
        }
        String note = value.toString().trim();
        if (note.length() > 4000) {
            throw ApiException.badRequest("NOTE_TOO_LONG", "The note must be 4000 characters or fewer");
        }
        auditService.record(principal.id(), "AUDITOR_NOTE", "business", id, null,
                Map.of("note", note));
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("business_id", id);
        response.put("note", note);
        return response;
    }
}
