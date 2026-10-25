package com.example.directory.subscription;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class SubscriptionExpiryJob {

    private final SubscriptionService subscriptionService;

    @Scheduled(fixedDelayString = "PT5M", initialDelayString = "PT30S")
    public void run() {
        int expired = subscriptionService.expireOverdue();
        if (expired > 0) {
            log.info("Expired {} researcher subscriptions", expired);
        }
    }
}
