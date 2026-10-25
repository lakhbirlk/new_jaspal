package com.example.directory.document;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentRepository extends JpaRepository<Document, UUID> {

    String SUMMARY_SELECT = """
            select d.id as id, d.ownerUserId as ownerUserId, d.businessId as businessId,
                   d.docType as docType, d.originalFilename as originalFilename,
                   d.mimeType as mimeType, d.sizeBytes as sizeBytes, d.checksum as checksum,
                   d.status as status, d.reviewedBy as reviewedBy, d.reviewedAt as reviewedAt,
                   d.rejectionReason as rejectionReason, d.createdAt as createdAt
            from Document d
            """;

    @Query(SUMMARY_SELECT + " where d.ownerUserId = :ownerId order by d.createdAt desc")
    List<DocumentSummary> findSummariesByOwner(@Param("ownerId") UUID ownerId);

    @Query(SUMMARY_SELECT + " where d.businessId = :businessId order by d.createdAt desc")
    List<DocumentSummary> findSummariesByBusiness(@Param("businessId") UUID businessId);

    @Query(SUMMARY_SELECT + " where d.id = :id")
    Optional<DocumentSummary> findSummaryById(@Param("id") UUID id);

    @Query(SUMMARY_SELECT + " where (:status is null or d.status = :status) order by d.createdAt desc")
    Page<DocumentSummary> findSummaries(@Param("status") DocumentStatus status, Pageable pageable);

    @Query("select d.content from Document d where d.id = :id")
    byte[] findContentById(@Param("id") UUID id);

    @Query("select count(d) from Document d where d.ownerUserId = :ownerId and d.docType = :docType and d.status <> :excluded")
    long countPresentDocuments(@Param("ownerId") UUID ownerId,
                               @Param("docType") DocumentType docType,
                               @Param("excluded") DocumentStatus excluded);

    @Query("select count(d) from Document d where d.ownerUserId = :ownerId and d.docType = :docType and d.status = :status")
    long countByOwnerAndTypeAndStatus(@Param("ownerId") UUID ownerId,
                                      @Param("docType") DocumentType docType,
                                      @Param("status") DocumentStatus status);

    @Modifying
    @Query("""
            update Document d set d.status = :status, d.reviewedBy = :reviewer,
                   d.reviewedAt = :now, d.rejectionReason = :reason
            where d.id = :id and d.status = :expected
            """)
    int review(@Param("id") UUID id,
               @Param("expected") DocumentStatus expected,
               @Param("status") DocumentStatus status,
               @Param("reviewer") UUID reviewer,
               @Param("now") Instant now,
               @Param("reason") String reason);

    long countByStatus(DocumentStatus status);
}
