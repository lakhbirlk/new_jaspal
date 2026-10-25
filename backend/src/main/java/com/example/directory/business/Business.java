package com.example.directory.business;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "businesses")
public class Business {

    @Id
    private UUID id;

    @Column(name = "owner_user_id")
    private UUID ownerUserId;

    @Column(name = "legal_name", nullable = false, length = 300)
    private String legalName;

    @Column(name = "trade_name", length = 300)
    private String tradeName;

    @Column(name = "registration_number", length = 100)
    private String registrationNumber;

    @Column(name = "tax_id")
    private String taxId;

    @Column(length = 150)
    private String industry;

    @Column(length = 150)
    private String category;

    @Column(name = "address_line", length = 500)
    private String addressLine;

    @Column(length = 150)
    private String city;

    @Column(length = 150)
    private String state;

    @Column(length = 150)
    private String country;

    @Column(name = "postal_code", length = 30)
    private String postalCode;

    @Column(length = 300)
    private String website;

    @Column(name = "public_email", length = 320)
    private String publicEmail;

    @Column(name = "public_phone", length = 40)
    private String publicPhone;

    @Column(name = "contact_person_name", length = 200)
    private String contactPersonName;

    @Column(name = "contact_person_phone", length = 40)
    private String contactPersonPhone;

    @Column(name = "annual_revenue")
    private BigDecimal annualRevenue;

    @Column(name = "employee_count")
    private Integer employeeCount;

    @Column(name = "bank_details")
    private String bankDetails;

    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", nullable = false, length = 20)
    private VerificationStatus verificationStatus = VerificationStatus.UNVERIFIED;

    @Column(name = "listed_until")
    private Instant listedUntil;

    @Enumerated(EnumType.STRING)
    @Column(name = "admin_listing_status", nullable = false, length = 20)
    private AdminListingStatus adminListingStatus = AdminListingStatus.UNLISTED;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        if (id == null) id = UUID.randomUUID();
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (verificationStatus == null) verificationStatus = VerificationStatus.UNVERIFIED;
        if (adminListingStatus == null) adminListingStatus = AdminListingStatus.UNLISTED;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public boolean isListedNow() {
        return adminListingStatus == AdminListingStatus.LISTED
                && listedUntil != null
                && listedUntil.isAfter(Instant.now());
    }
}
