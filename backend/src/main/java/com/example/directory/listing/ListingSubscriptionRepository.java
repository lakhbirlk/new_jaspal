package com.example.directory.listing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface ListingSubscriptionRepository extends JpaRepository<ListingSubscription, UUID> {

    List<ListingSubscription> findByBusinessIdOrderByCreatedAtDesc(UUID businessId);

    List<ListingSubscription> findByBusinessIdAndStatusIn(UUID businessId,
                                                          List<ListingSubscriptionStatus> statuses);

    java.util.Optional<ListingSubscription> findFirstByBusinessIdAndStatusOrderByEndsAtDesc(
            UUID businessId, ListingSubscriptionStatus status);

    List<ListingSubscription> findByStatusAndEndsAtBefore(ListingSubscriptionStatus status, Instant now);

    List<ListingSubscription> findByStatusAndCreatedAtBefore(ListingSubscriptionStatus status,
                                                             Instant cutoff);

    List<ListingSubscription> findByStatusAndEndsAtBetween(ListingSubscriptionStatus status,
                                                           Instant from, Instant to);

    long countByStatus(ListingSubscriptionStatus status);
}
