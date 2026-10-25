package com.example.directory.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ProfileRequirementRepository extends JpaRepository<ProfileRequirement, UUID> {

    List<ProfileRequirement> findByRoleOrderByKindAscNameAsc(Role role);
}
