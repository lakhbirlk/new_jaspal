package com.example.directory.document;

import com.example.directory.auth.AuthPrincipal;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;

    @PostMapping("/my/documents")
    @PreAuthorize("hasAuthority('document:upload')")
    public Map<String, Object> upload(@RequestPart("file") MultipartFile file,
                                      @RequestParam @NotBlank String docType,
                                      @AuthenticationPrincipal AuthPrincipal principal) {
        return documentService.upload(principal, file, docType);
    }

    @GetMapping("/my/documents")
    @PreAuthorize("hasAuthority('document:read')")
    public List<Map<String, Object>> listOwn(@AuthenticationPrincipal AuthPrincipal principal) {
        return documentService.listOwn(principal);
    }

    @GetMapping("/documents/{id}/content")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Resource> download(@PathVariable UUID id,
                                             @AuthenticationPrincipal AuthPrincipal principal) {
        return documentService.download(id, principal);
    }

    @GetMapping("/audit/businesses/{id}/documents")
    @PreAuthorize("hasAnyAuthority('document:read','business:read')")
    public List<Map<String, Object>> businessDocuments(@PathVariable UUID id,
                                                       @AuthenticationPrincipal AuthPrincipal principal) {
        return documentService.listForBusiness(id, principal);
    }
}
