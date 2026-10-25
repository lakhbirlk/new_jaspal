package com.example.directory.auth;

import com.example.directory.config.AppProperties;
import com.example.directory.user.Role;
import com.example.directory.user.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class JwtService {

    public static final String TYPE_ACCESS = "access";
    public static final String TYPE_PURPOSE = "purpose";

    private final AppProperties properties;
    private SecretKey key;

    @PostConstruct
    void init() {
        String secret = properties.getJwt().getSecret();
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET must be at least 32 bytes");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String createAccessToken(User user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(user.getId().toString())
                .claim("role", user.getRole().name())
                .claim("ver", user.getTokenVersion())
                .claim("typ", TYPE_ACCESS)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(properties.getJwt().getAccessTokenMinutes(), ChronoUnit.MINUTES)))
                .signWith(key)
                .compact();
    }

    public String createPurposeToken(UUID userId, String purpose, int minutes) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(userId.toString())
                .claim("purpose", purpose)
                .claim("typ", TYPE_PURPOSE)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(minutes, ChronoUnit.MINUTES)))
                .signWith(key)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public UUID userId(Claims claims) {
        return UUID.fromString(claims.getSubject());
    }

    public Role role(Claims claims) {
        String role = claims.get("role", String.class);
        return role == null ? null : Role.valueOf(role);
    }

    public int tokenVersion(Claims claims) {
        Number value = claims.get("ver", Number.class);
        return value == null ? -1 : value.intValue();
    }

    public String type(Claims claims) {
        return claims.get("typ", String.class);
    }

    public String purpose(Claims claims) {
        return claims.get("purpose", String.class);
    }

    public long accessTokenSeconds() {
        return properties.getJwt().getAccessTokenMinutes() * 60L;
    }

    public boolean isAccessToken(Claims claims) {
        return TYPE_ACCESS.equals(type(claims));
    }
}
