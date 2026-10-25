package com.example.directory.document;

import com.example.directory.auth.AuthPrincipal;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/documents")
@RequiredArgsConstructor
public class DocumentAdminController {

    private final DocumentService documentService;

    public record RejectRequest(@NotBlank String reason) {
    }

    @GetMapping
    @PreAuthorize("hasAuthority('document:review')")
    public Map<String, Object> queue(@RequestParam(required = false) String status,
                                     @RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "20") int size) {
        return documentService.reviewQueue(status, page, size);
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('document:review')")
    public Map<String, Object> approve(@PathVariable UUID id,
                                       @AuthenticationPrincipal AuthPrincipal principal) {
        return documentService.approve(id, principal);
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAuthority('document:review')")
    public Map<String, Object> reject(@PathVariable UUID id, @RequestBody RejectRequest request,
                                      @AuthenticationPrincipal AuthPrincipal principal) {
        return documentService.reject(id, principal, request.reason());
    }
}
