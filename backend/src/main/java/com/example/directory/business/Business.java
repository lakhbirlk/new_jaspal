package com.example.directory.business;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
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

    @Column(name = "net_profit")
    private BigDecimal netProfit;

    @Column(name = "net_worth")
    private BigDecimal netWorth;

    /** Monthly turnover in rupees, oldest first, up to 36 entries. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "monthly_turnover", columnDefinition = "json")
    private List<Long> monthlyTurnover;

    @Column(name = "bank_details", columnDefinition = "text")
    private String bankDetails;

    @Column(columnDefinition = "text")
    private String description;

    /** URL of the company's corporate profile video, shown to research members. */
    @Column(name = "profile_video_url", length = 500)
    private String profileVideoUrl;

    /** Declared loans and liabilities, published for research transparency. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "liabilities", columnDefinition = "json")
    private List<Liability> liabilities;

    /** The chartered accountant who certifies this company's financial statements. */
    @Column(name = "ca_name", length = 200)
    private String caName;

    @Column(name = "ca_membership_no", length = 40)
    private String caMembershipNo;

    @Column(name = "ca_udin", length = 40)
    private String caUdin;

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
