package com.example.directory.auth;

import com.example.directory.user.User;
import com.example.directory.user.UserRepository;
import com.example.directory.user.UserStatus;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final AuthorityService authorityService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            Claims claims = jwtService.parse(header.substring(7).trim());
            if (!jwtService.isAccessToken(claims)) {
                filterChain.doFilter(request, response);
                return;
            }
            UUID userId = jwtService.userId(claims);
            Optional<User> optional = userRepository.findById(userId);
            if (optional.isEmpty()) {
                filterChain.doFilter(request, response);
                return;
            }
            User user = optional.get();
            if (user.getStatus() == UserStatus.SUSPENDED
                    || user.getStatus() == UserStatus.PENDING_EMAIL
                    || jwtService.tokenVersion(claims) != user.getTokenVersion()) {
                filterChain.doFilter(request, response);
                return;
            }

            AuthPrincipal principal = new AuthPrincipal(user.getId(), user.getRole(),
                    user.getStatus(), user.getStatus() != UserStatus.ACTIVE);
            var authorities = authorityService.authorities(user).stream()
                    .map(SimpleGrantedAuthority::new)
                    .collect(Collectors.toSet());
            var authentication = new UsernamePasswordAuthenticationToken(principal, null, authorities);
            authentication.setDetails(request.getRequestURI());
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (Exception ex) {
            log.debug("Rejected bearer token: {}", ex.getMessage());
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);
    }
}
