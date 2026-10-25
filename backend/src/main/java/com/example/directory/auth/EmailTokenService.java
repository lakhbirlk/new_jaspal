package com.example.directory.auth;

import com.example.directory.common.ApiException;
import com.example.directory.common.CryptoService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EmailTokenService {

    private final EmailTokenRepository repository;
    private final SecureRandom random = new SecureRandom();

    @Transactional
    public String create(UUID userId, EmailToken.Purpose purpose, long hours) {
        return create(userId, purpose, Duration.ofHours(hours));
    }

    @Transactional
    public String create(UUID userId, EmailToken.Purpose purpose, Duration ttl) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        EmailToken token = new EmailToken();
        token.setUserId(userId);
        token.setPurpose(purpose);
        token.setTokenHash(CryptoService.sha256Hex(raw));
        token.setExpiresAt(Instant.now().plus(ttl));
        repository.save(token);
        return raw;
    }

    @Transactional
    public EmailToken consume(String raw, EmailToken.Purpose purpose) {
        if (raw == null || raw.isBlank()) {
            throw invalid();
        }
        EmailToken token = repository.findForUpdate(CryptoService.sha256Hex(raw), purpose)
                .orElseThrow(EmailTokenService::invalid);
        if (token.getUsedAt() != null || token.getExpiresAt().isBefore(Instant.now())) {
            throw invalid();
        }
        token.setUsedAt(Instant.now());
        repository.save(token);
        return token;
    }

    private static ApiException invalid() {
        return ApiException.badRequest("TOKEN_INVALID", "This link is invalid or has expired");
    }
}
