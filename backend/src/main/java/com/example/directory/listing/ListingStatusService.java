package com.example.directory.listing;

import com.example.directory.business.AdminListingStatus;
import com.example.directory.business.Business;
import com.example.directory.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class ListingStatusService {

    private final UserRepository userRepository;

    public ListingStatus statusOf(Business business) {
        boolean ownerApproved = business.getOwnerUserId() != null
                && userRepository.findById(business.getOwnerUserId())
                .map(user -> user.getStatus() == com.example.directory.user.UserStatus.ACTIVE)
                .orElse(false);
        if (!ownerApproved) {
            return ListingStatus.NOT_APPROVED;
        }
        if (business.getAdminListingStatus() != AdminListingStatus.LISTED) {
            return ListingStatus.UNLISTED_BY_ADMIN;
        }
        if (business.getListedUntil() != null && business.getListedUntil().isAfter(Instant.now())) {
            return ListingStatus.LISTED;
        }
        return business.getListedUntil() == null ? ListingStatus.AWAITING_PLAN : ListingStatus.EXPIRED;
    }

    public boolean visibleToResearchers(Business business) {
        return statusOf(business) == ListingStatus.LISTED;
    }
}
