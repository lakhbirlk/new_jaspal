package com.example.directory.search;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ResearchAccessLogRepository extends JpaRepository<ResearchAccessLog, UUID> {
}
