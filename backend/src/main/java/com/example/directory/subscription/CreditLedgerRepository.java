package com.example.directory.subscription;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.UUID;

public interface CreditLedgerRepository extends JpaRepository<CreditLedgerEntry, UUID> {

    Page<CreditLedgerEntry> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    @Query("""
            select coalesce(sum(case when e.amount < 0 then -e.amount else 0 end), 0)
            from CreditLedgerEntry e
            where e.entryType = :type and e.createdAt >= :from
            """)
    long sumSpentSince(@Param("type") LedgerEntryType type, @Param("from") Instant from);
}
