package com.example.directory.user;

import com.example.directory.auth.AuthPrincipal;
import com.example.directory.common.PageResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final UserService userService;

    public record RejectRequest(@NotBlank String reason) {
    }

    public record InviteRequest(@NotBlank @Email String email,
                                @NotBlank String fullName,
                                @NotBlank String role) {
    }

    @GetMapping
    @PreAuthorize("hasAuthority('user:read')")
    public PageResult<Map<String, Object>> list(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return userService.list(role, status, q, page, size);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('user:read')")
    public Map<String, Object> detail(@PathVariable UUID id) {
        return userService.detail(id);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAuthority('user:update')")
    public Map<String, Object> update(@PathVariable UUID id,
                                      @RequestBody UserService.UpdateUser request,
                                      @AuthenticationPrincipal AuthPrincipal actor) {
        return userService.update(id, request, actor);
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('user:update')")
    public Map<String, Object> approve(@PathVariable UUID id,
                                       @AuthenticationPrincipal AuthPrincipal actor) {
        return userService.approve(id, actor);
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAuthority('user:update')")
    public Map<String, Object> reject(@PathVariable UUID id,
                                      @Valid @RequestBody RejectRequest request,
                                      @AuthenticationPrincipal AuthPrincipal actor) {
        return userService.reject(id, request.reason(), actor);
    }

    @PostMapping("/{id}/suspend")
    @PreAuthorize("hasAuthority('user:update')")
    public Map<String, Object> suspend(@PathVariable UUID id,
                                       @AuthenticationPrincipal AuthPrincipal actor) {
        return userService.setSuspended(id, true, actor);
    }

    @PostMapping("/{id}/activate")
    @PreAuthorize("hasAuthority('user:update')")
    public Map<String, Object> activate(@PathVariable UUID id,
                                        @AuthenticationPrincipal AuthPrincipal actor) {
        return userService.setSuspended(id, false, actor);
    }

    @PostMapping("/{id}/reset-password")
    @PreAuthorize("hasAuthority('user:update')")
    public Map<String, Object> resetPassword(@PathVariable UUID id,
                                             @AuthenticationPrincipal AuthPrincipal actor) {
        return userService.forcePasswordReset(id, actor);
    }

    @PostMapping("/{id}/reset-mfa")
    @PreAuthorize("hasAuthority('user:update')")
    public ResponseEntity<Void> resetMfa(@PathVariable UUID id,
                                         @AuthenticationPrincipal AuthPrincipal actor) {
        userService.resetMfa(id, actor);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/invite")
    @PreAuthorize("hasAuthority('user:update')")
    public ResponseEntity<Map<String, Object>> invite(@Valid @RequestBody InviteRequest request,
                                                      @AuthenticationPrincipal AuthPrincipal actor) {
        return ResponseEntity.status(201)
                .body(userService.invite(request.email(), request.fullName(), request.role(), actor));
    }
}
