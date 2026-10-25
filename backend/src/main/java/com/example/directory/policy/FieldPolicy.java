package com.example.directory.policy;

import com.example.directory.user.Role;
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
@Table(name = "field_policies")
public class FieldPolicy {

    @Id
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Column(nullable = false, length = 60)
    private String resource;

    @Column(nullable = false, length = 80)
    private String field;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Access access;

    @Enumerated(EnumType.STRING)
    @Column(name = "unlock_state", nullable = false, length = 10)
    private UnlockState unlockState = UnlockState.ANY;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        if (id == null) id = UUID.randomUUID();
        updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
