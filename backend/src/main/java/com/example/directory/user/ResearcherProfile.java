package com.example.directory.user;

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
@Table(name = "researcher_profiles")
public class ResearcherProfile {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "full_name", length = 200)
    private String fullName;

    @Column(length = 200)
    private String organization;

    @Column(length = 200)
    private String designation;

    @Column(length = 40)
    private String phone;

    @Column(name = "purpose_of_research")
    private String purposeOfResearch;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}
