package com.example.directory.policy;

import com.example.directory.user.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FieldPolicyRepository extends JpaRepository<FieldPolicy, UUID> {

    List<FieldPolicy> findAllByOrderByRoleAscResourceAscFieldAscUnlockStateAsc();

    List<FieldPolicy> findByRoleAndResource(Role role, String resource);
}
