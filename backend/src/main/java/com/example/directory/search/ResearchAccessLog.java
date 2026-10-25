package com.example.directory.search;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "research_access_log")
public class ResearchAccessLog {

    @Id
    private UUID id;

    @Column(name = "researcher_user_id", nullable = false)
    private UUID researcherUserId;

    @Column(name = "business_id")
    private UUID businessId;

    private String query;

    @Column(name = "viewed_at", nullable = false)
    private Instant viewedAt;

    @PrePersist
    void onCreate() {
        if (id == null) id = UUID.randomUUID();
        if (viewedAt == null) viewedAt = Instant.now();
    }
}
