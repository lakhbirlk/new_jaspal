package com.example.directory.document;

import com.example.directory.audit.AuditService;
import com.example.directory.auth.AuthPrincipal;
import com.example.directory.business.Business;
import com.example.directory.business.BusinessRepository;
import com.example.directory.common.ApiException;
import com.example.directory.common.CryptoService;
import com.example.directory.user.Role;
import com.example.directory.user.User;
import com.example.directory.user.UserRepository;
import com.example.directory.user.UserStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class DocumentService {

    private static final Set<String> ALLOWED_MIME = Set.of(
            "application/pdf", "image/jpeg", "image/png");
    private static final long MAX_BYTES = 10L * 1024 * 1024;

    private final DocumentRepository repository;
    private final UserRepository userRepository;
    private final BusinessRepository businessRepository;
    private final CryptoService cryptoService;
    private final AuditService auditService;

    @Transactional
    public Map<String, Object> upload(AuthPrincipal principal, MultipartFile file, String docTypeValue) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("FILE_REQUIRED", "A document file is required");
        }
        if (file.getSize() > MAX_BYTES) {
            throw ApiException.badRequest("FILE_TOO_LARGE", "The maximum file size is 10 MB");
        }
        String mime = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (!ALLOWED_MIME.contains(mime)) {
            throw ApiException.badRequest("FILE_TYPE_NOT_ALLOWED",
                    "Only PDF, JPEG and PNG documents are accepted");
        }
        DocumentType docType;
        try {
            docType = DocumentType.from(docTypeValue);
        } catch (Exception ex) {
            throw ApiException.badRequest("INVALID_DOCUMENT_TYPE", ex.getMessage());
        }

        User user = userRepository.findById(principal.id())
                .orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "User not found"));
        if (user.getStatus() == UserStatus.PENDING_REVIEW) {
            throw ApiException.conflict("PROFILE_UNDER_REVIEW",
                    "Documents cannot be changed while the profile is under review");
        }
        if (principal.role() == Role.RESEARCHER && docType != DocumentType.ID_PROOF) {
            throw ApiException.badRequest("INVALID_DOCUMENT_TYPE",
                    "Researchers upload an ID proof document");
        }
        if (principal.role() != Role.RESEARCHER && principal.role() != Role.BUSINESS) {
            throw ApiException.forbidden("UPLOAD_NOT_ALLOWED", "This role cannot upload documents here");
        }

        UUID businessId = null;
        if (principal.role() == Role.BUSINESS) {
            Business business = businessRepository.findByOwnerUserId(principal.id())
                    .orElseThrow(() -> ApiException.notFound("BUSINESS_NOT_FOUND",
                            "No business is associated with this account"));
            businessId = business.getId();
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (Exception ex) {
            throw ApiException.badRequest("FILE_READ_FAILED", "Could not read the uploaded file");
        }

        Document document = new Document();
        document.setOwnerUserId(principal.id());
        document.setBusinessId(businessId);
        document.setDocType(docType);
        document.setOriginalFilename(safeFilename(file.getOriginalFilename()));
        document.setContent(cryptoService.encryptBytes(bytes));
        document.setMimeType(mime);
        document.setSizeBytes(bytes.length);
        document.setChecksum(CryptoService.sha256Hex(bytes));
        document.setStatus(DocumentStatus.PENDING);
        document = repository.save(document);
        auditService.record(principal.id(), "DOCUMENT_UPLOADED", "document", document.getId(), null,
                Map.of("docType", docType.name(), "status", "PENDING", "sizeBytes", bytes.length));
        return summaryMap(repository.findSummaryById(document.getId()).orElseThrow());
    }

    public List<Map<String, Object>> listOwn(AuthPrincipal principal) {
        return repository.findSummariesByOwner(principal.id()).stream()
                .map(this::summaryMap).toList();
    }

    public List<Map<String, Object>> listForBusiness(UUID businessId, AuthPrincipal principal) {
        if (principal.role() == Role.BUSINESS) {
            Business business = businessRepository.findByOwnerUserId(principal.id())
                    .orElseThrow(() -> ApiException.notFound("BUSINESS_NOT_FOUND", "Business not found"));
            if (!business.getId().equals(businessId)) {
                throw ApiException.notFound("BUSINESS_NOT_FOUND", "Business not found");
            }
        }
        return repository.findSummariesByBusiness(businessId).stream().map(this::summaryMap).toList();
    }

    public ResponseEntity<Resource> download(UUID documentId, AuthPrincipal principal) {
        DocumentSummary summary = repository.findSummaryById(documentId)
                .orElseThrow(() -> ApiException.notFound("DOCUMENT_NOT_FOUND", "Document not found"));
        boolean owner = summary.getOwnerUserId().equals(principal.id());
        boolean reviewer = principal.role() == Role.ADMIN || principal.role() == Role.AUDITOR;
        if (!owner && !reviewer) {
            throw ApiException.notFound("DOCUMENT_NOT_FOUND", "Document not found");
        }
        byte[] encrypted = repository.findContentById(documentId);
        if (encrypted == null) {
            throw ApiException.notFound("DOCUMENT_NOT_FOUND", "Document not found");
        }
        byte[] content = cryptoService.decryptBytes(encrypted);
        auditService.record(principal.id(), "DOCUMENT_DOWNLOADED", "document", documentId, null,
                Map.of("ownerUserId", summary.getOwnerUserId()));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(summary.getOriginalFilename()).build().toString())
                .contentType(MediaType.parseMediaType(summary.getMimeType()))
                .body(new ByteArrayResource(content));
    }

    public Map<String, Object> reviewQueue(String status, int page, int size) {
        DocumentStatus parsed = null;
        if (status != null && !status.isBlank()) {
            try {
                parsed = DocumentStatus.valueOf(status.toUpperCase(Locale.ROOT));
            } catch (Exception ex) {
                throw ApiException.badRequest("INVALID_STATUS", "Unknown document status");
            }
        }
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        var result = repository.findSummaries(parsed, pageable);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", result.getContent().stream().map(this::summaryMap).toList());
        response.put("page", result.getNumber());
        response.put("size", result.getSize());
        response.put("total", result.getTotalElements());
        response.put("totalPages", result.getTotalPages());
        return response;
    }

    @Transactional
    public Map<String, Object> approve(UUID documentId, AuthPrincipal reviewer) {
        return doReview(documentId, reviewer, DocumentStatus.APPROVED, null);
    }

    @Transactional
    public Map<String, Object> reject(UUID documentId, AuthPrincipal reviewer, String reason) {
        if (reason == null || reason.isBlank()) {
            throw ApiException.badRequest("REASON_REQUIRED", "A rejection reason is required");
        }
        return doReview(documentId, reviewer, DocumentStatus.REJECTED, reason.trim());
    }

    private Map<String, Object> doReview(UUID documentId, AuthPrincipal reviewer,
                                         DocumentStatus status, String reason) {
        DocumentSummary before = repository.findSummaryById(documentId)
                .orElseThrow(() -> ApiException.notFound("DOCUMENT_NOT_FOUND", "Document not found"));
        int updated = repository.review(documentId, DocumentStatus.PENDING, status,
                reviewer.id(), Instant.now(), reason);
        if (updated == 0) {
            throw ApiException.conflict("DOCUMENT_ALREADY_REVIEWED",
                    "Only documents that are pending can be reviewed");
        }
        Map<String, Object> after = summaryMap(repository.findSummaryById(documentId).orElseThrow());
        auditService.record(reviewer.id(), "DOCUMENT_" + status.name(), "document", documentId,
                summaryMap(before), after);
        return after;
    }

    public Map<String, Object> summaryMap(DocumentSummary document) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", document.getId());
        map.put("ownerUserId", document.getOwnerUserId());
        map.put("businessId", document.getBusinessId());
        map.put("docType", document.getDocType().name().toLowerCase(Locale.ROOT));
        map.put("originalFilename", document.getOriginalFilename());
        map.put("mimeType", document.getMimeType());
        map.put("sizeBytes", document.getSizeBytes());
        map.put("checksum", document.getChecksum());
        map.put("status", document.getStatus().name().toLowerCase(Locale.ROOT));
        map.put("reviewedBy", document.getReviewedBy());
        map.put("reviewedAt", document.getReviewedAt());
        map.put("rejectionReason", document.getRejectionReason());
        map.put("createdAt", document.getCreatedAt());
        return map;
    }

    private String safeFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            return "document";
        }
        String cleaned = filename.replaceAll("[\\\\/\\r\\n]", "_").trim();
        return cleaned.substring(0, Math.min(cleaned.length(), 255));
    }
}
