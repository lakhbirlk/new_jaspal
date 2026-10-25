package com.example.directory.auth;

import com.example.directory.common.ClientInfo;
import com.example.directory.common.CryptoService;
import com.example.directory.config.AppProperties;
import com.example.directory.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private final RefreshTokenRepository repository;
    private final AppProperties properties;
    private final SecureRandom random = new SecureRandom();

    @Transactional
    public String create(User user) {
        return create(user, UUID.randomUUID());
    }

    @Transactional
    public String rotate(RefreshToken current, User user) {
        current.setRevokedAt(Instant.now());
        repository.save(current);
        return create(user, current.getFamilyId());
    }

    private String create(User user, UUID familyId) {
        String raw = randomToken();
        RefreshToken token = new RefreshToken();
        token.setUserId(user.getId());
        token.setTokenHash(CryptoService.sha256Hex(raw));
        token.setFamilyId(familyId);
        token.setExpiresAt(Instant.now().plus(properties.getJwt().getRefreshTokenDays(), ChronoUnit.DAYS));
        token.setIp(ClientInfo.ip());
        token.setUserAgent(ClientInfo.userAgent());
        repository.save(token);
        return raw;
    }

    public String rawForLookup(String raw) {
        return CryptoService.sha256Hex(raw);
    }

    private String randomToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
