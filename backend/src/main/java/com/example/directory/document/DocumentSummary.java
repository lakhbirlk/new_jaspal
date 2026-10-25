package com.example.directory.document;

import java.time.Instant;
import java.util.UUID;

public interface DocumentSummary {
    UUID getId();
    UUID getOwnerUserId();
    UUID getBusinessId();
    DocumentType getDocType();
    String getOriginalFilename();
    String getMimeType();
    Long getSizeBytes();
    String getChecksum();
    DocumentStatus getStatus();
    UUID getReviewedBy();
    Instant getReviewedAt();
    String getRejectionReason();
    Instant getCreatedAt();
}
