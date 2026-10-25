package com.example.directory.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ResearcherProfileRepository extends JpaRepository<ResearcherProfile, UUID> {
}
