package com.example.directory.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface RolePermissionRepository extends JpaRepository<RolePermission, UUID> {

    @Query("select rp.permission.code from RolePermission rp where rp.role = :role")
    List<String> findPermissionCodes(@Param("role") Role role);

    @Query("select rp from RolePermission rp join fetch rp.permission where rp.role = :role")
    List<RolePermission> findAllByRole(@Param("role") Role role);

    void deleteByRole(Role role);
}
