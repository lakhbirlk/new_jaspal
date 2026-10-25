package com.example.directory.subscription;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Read-side unlock checks. These are evaluated at read time so a subscription ending is
 * exact to the second, even if the scheduled expiry job has not run yet.
 */
@Service
@RequiredArgsConstructor
public class UnlockService {

    private final BusinessUnlockRepository unlockRepository;

    public boolean isUnlockedNow(UUID userId, UUID businessId) {
        return unlockRepository.existsActiveUnlock(userId, businessId,
                SubscriptionStatus.ACTIVE, Instant.now());
    }

    public Set<UUID> unlockedBusinessIds(UUID userId, Collection<UUID> businessIds) {
        if (businessIds == null || businessIds.isEmpty()) {
            return Set.of();
        }
        return new HashSet<>(unlockRepository.findActiveUnlockIds(userId, businessIds,
                SubscriptionStatus.ACTIVE, Instant.now()));
    }
}
