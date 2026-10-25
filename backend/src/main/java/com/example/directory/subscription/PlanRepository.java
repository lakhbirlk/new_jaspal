package com.example.directory.subscription;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlanRepository extends JpaRepository<Plan, UUID> {

    Optional<Plan> findByCodeIgnoreCase(String code);

    List<Plan> findByAudienceAndActiveTrueOrderByPriceAmountAsc(PlanAudience audience);

    List<Plan> findAllByOrderByAudienceAscPriceAmountAsc();
}
