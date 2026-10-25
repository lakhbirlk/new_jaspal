package com.example.directory.auth;

import com.example.directory.user.Role;
import com.example.directory.user.UserStatus;

import java.util.UUID;

public record AuthPrincipal(UUID id, Role role, UserStatus status, boolean restricted) {
}
