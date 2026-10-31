package com.example.directory.subscription;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public interface BusinessUnlockRepository extends JpaRepository<BusinessUnlock, UUID> {

    Optional<BusinessUnlock> findBySubscriptionIdAndBusinessId(UUID subscriptionId, UUID businessId);

    List<BusinessUnlock> findByUserIdOrderByUnlockedAtDesc(UUID userId);

    /** Moves unlocks to the replacement subscription when a researcher upgrades their plan. */
    @Modifying(flushAutomatically = true)
    @Query("update BusinessUnlock bu set bu.subscriptionId = :newSubscriptionId "
            + "where bu.subscriptionId = :previousSubscriptionId")
    int reassignSubscription(@Param("previousSubscriptionId") UUID previousSubscriptionId,
                             @Param("newSubscriptionId") UUID newSubscriptionId);

    @Query("""
            select case when count(bu) > 0 then true else false end
            from BusinessUnlock bu
            where bu.userId = :userId and bu.businessId = :businessId
              and exists (select s.id from Subscription s
                          where s.id = bu.subscriptionId and s.status = :status and s.endsAt > :now)
            """)
    boolean existsActiveUnlock(@Param("userId") UUID userId,
                               @Param("businessId") UUID businessId,
                               @Param("status") SubscriptionStatus status,
                               @Param("now") Instant now);

    @Query("""
            select distinct bu.businessId
            from BusinessUnlock bu
            where bu.userId = :userId and bu.businessId in :businessIds
              and exists (select s.id from Subscription s
                          where s.id = bu.subscriptionId and s.status = :status and s.endsAt > :now)
            """)
    Set<UUID> findActiveUnlockIds(@Param("userId") UUID userId,
                                  @Param("businessIds") Collection<UUID> businessIds,
                                  @Param("status") SubscriptionStatus status,
                                  @Param("now") Instant now);

    @Query("""
            select bu from BusinessUnlock bu
            where bu.userId = :userId
              and exists (select s.id from Subscription s
                          where s.id = bu.subscriptionId and s.status = :status and s.endsAt > :now)
            order by bu.unlockedAt desc
            """)
    List<BusinessUnlock> findActiveUnlocks(@Param("userId") UUID userId,
                                           @Param("status") SubscriptionStatus status,
                                           @Param("now") Instant now);
}
