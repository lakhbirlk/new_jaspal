package com.example.directory.common;

import com.example.directory.auth.AuthPrincipal;
import com.example.directory.auth.CurrentUser;
import com.example.directory.config.AppProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Small fixed-window limiter held in the JVM. It intentionally covers only the abuse-prone
 * endpoints; account lockout counters live in the users table.
 */
@Component
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {

    private final AppProperties properties;
    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final AtomicLong calls = new AtomicLong();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (calls.incrementAndGet() % 2000 == 0) {
            Instant now = Instant.now();
            windows.entrySet().removeIf(entry -> entry.getValue().resetAt.isBefore(now));
        }

        String limitKey = null;
        int limit = 0;
        String path = request.getRequestURI();

        if ("POST".equals(request.getMethod()) && path.equals("/api/v1/auth/login")) {
            limitKey = "login:" + ClientInfo.ip();
            limit = properties.getRateLimit().getLoginPerMinute();
        } else if ("POST".equals(request.getMethod()) && path.equals("/api/v1/auth/register")) {
            limitKey = "register:" + ClientInfo.ip();
            limit = properties.getRateLimit().getRegisterPerMinute();
        } else if ("GET".equals(request.getMethod())
                && (path.equals("/api/v1/businesses")
                    || path.equals("/api/v1/public/businesses")
                    || path.startsWith("/api/v1/public/businesses/"))) {
            AuthPrincipal principal = principal();
            limitKey = "search:" + (principal != null ? principal.id() : ClientInfo.ip());
            limit = properties.getRateLimit().getSearchPerMinute();
        }

        if (limitKey != null && limit > 0 && !allow(limitKey, limit)) {
            response.setStatus(429);
            response.setHeader("Retry-After", "60");
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            objectMapper.writeValue(response.getOutputStream(),
                    Map.of("code", "RATE_LIMITED", "message", "Too many requests. Try again shortly."));
            return;
        }

        filterChain.doFilter(request, response);
    }

    private AuthPrincipal principal() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthPrincipal principal) {
            return principal;
        }
        return null;
    }

    private boolean allow(String key, int limit) {
        Instant now = Instant.now();
        Window window = windows.compute(key, (ignored, current) -> {
            if (current == null || current.resetAt.isBefore(now)) {
                return new Window(1, now.plusSeconds(60));
            }
            current.count++;
            return current;
        });
        return window.count <= limit;
    }

    private static final class Window {
        private int count;
        private final Instant resetAt;

        private Window(int count, Instant resetAt) {
            this.count = count;
            this.resetAt = resetAt;
        }
    }
}
