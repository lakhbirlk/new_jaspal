package com.example.directory.auth;

import com.example.directory.user.Role;
import com.example.directory.user.RolePermissionRepository;
import com.example.directory.user.User;
import com.example.directory.user.UserStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AuthorityService {

    private final RolePermissionRepository rolePermissionRepository;

    public Set<String> authorities(User user) {
        Set<String> authorities = new LinkedHashSet<>();
        authorities.add("ROLE_" + user.getRole().name());
        authorities.add("profile:read");
        authorities.add("status:read");

        if (user.getStatus() == UserStatus.ACTIVE) {
            authorities.addAll(rolePermissionRepository.findPermissionCodes(user.getRole()));
            if (user.getRole() == Role.RESEARCHER) {
                authorities.add("profile:edit");
            }
            return authorities;
        }

        // Restricted session: profile, document and status endpoints only.
        authorities.add("document:upload");
        authorities.add("document:read");
        if (user.getRole() == Role.RESEARCHER) {
            authorities.add("profile:edit");
        }
        if (user.getRole() == Role.BUSINESS) {
            authorities.add("business:update");
            authorities.add("profile:edit");
        }
        return authorities;
    }
}
