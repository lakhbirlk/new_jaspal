package com.example.directory.policy;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface UserPolicyOverrideRepository extends JpaRepository<UserPolicyOverride, UUID> {

    List<UserPolicyOverride> findByUserIdOrderByResourceAscFieldAsc(UUID userId);

    List<UserPolicyOverride> findAllByUserId(UUID userId);
}
