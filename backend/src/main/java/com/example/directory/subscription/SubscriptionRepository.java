package com.example.directory.subscription;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SubscriptionRepository extends JpaRepository<Subscription, UUID>,
        JpaSpecificationExecutor<Subscription> {

    Optional<Subscription> findFirstByUserIdAndStatusOrderByEndsAtDesc(UUID userId, SubscriptionStatus status);

    boolean existsByUserIdAndStatus(UUID userId, SubscriptionStatus status);

    long countByStatus(SubscriptionStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Subscription s where s.userId = :userId and s.status = :status and s.endsAt > :now")
    Optional<Subscription> findActiveForUpdate(@Param("userId") UUID userId,
                                               @Param("status") SubscriptionStatus status,
                                               @Param("now") Instant now);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Subscription s where s.id = :id")
    Optional<Subscription> findByIdForUpdate(@Param("id") UUID id);

    List<Subscription> findByUserIdAndStatus(UUID userId, SubscriptionStatus status);

    List<Subscription> findByStatusAndEndsAtBefore(SubscriptionStatus status, Instant now);

    List<Subscription> findByUserIdOrderByCreatedAtDesc(UUID userId);
}
