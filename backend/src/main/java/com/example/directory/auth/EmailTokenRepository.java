package com.example.directory.auth;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface EmailTokenRepository extends JpaRepository<EmailToken, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from EmailToken t where t.tokenHash = :hash and t.purpose = :purpose")
    Optional<EmailToken> findForUpdate(@Param("hash") String hash,
                                       @Param("purpose") EmailToken.Purpose purpose);

    @Query("delete from EmailToken t where t.expiresAt < :cutoff and t.usedAt is not null")
    int deleteOld(@Param("cutoff") Instant cutoff);
}
