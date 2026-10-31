package com.example.directory.business;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BusinessRepository extends JpaRepository<Business, UUID>, JpaSpecificationExecutor<Business> {

    Optional<Business> findByOwnerUserId(UUID ownerUserId);

    long countByAdminListingStatus(AdminListingStatus status);

    @Query("""
            select b from Business b
            where b.adminListingStatus = com.example.directory.business.AdminListingStatus.LISTED
              and b.listedUntil > :now
            """)
    List<Business> findCurrentlyListed(@Param("now") Instant now);

    @Query("""
            select b from Business b
            where b.adminListingStatus = com.example.directory.business.AdminListingStatus.LISTED
              and b.listedUntil > :now
              and b.listedUntil < :soon
            """)
    List<Business> findExpiringBetween(@Param("now") Instant now, @Param("soon") Instant soon);

    @Query(value = """
            select b.* from businesses b
            join users u on u.id = b.owner_user_id
            where u.status = 'ACTIVE'
              and b.admin_listing_status = 'LISTED'
              and b.listed_until > now()
              and (:q is null or
                   lower(concat_ws(' ',
                       coalesce(b.legal_name,''), coalesce(b.trade_name,''), coalesce(b.industry,''),
                       coalesce(b.category,''), coalesce(b.city,''), coalesce(b.country,''),
                       coalesce(b.description,'')))
                   like concat('%', lower(:q), '%'))
              and (:industry is null or lower(b.industry) = lower(:industry))
              and (:city is null or lower(b.city) = lower(:city))
              and (:state is null or lower(b.state) = lower(:state))
              and (:minRevenue is null or b.annual_revenue >= :minRevenue)
              and (:maxRevenue is null or b.annual_revenue < :maxRevenue)
            """,
            countQuery = """
            select count(*)
            from businesses b
            join users u on u.id = b.owner_user_id
            where u.status = 'ACTIVE'
              and b.admin_listing_status = 'LISTED'
              and b.listed_until > now()
              and (:q is null or
                   lower(concat_ws(' ',
                       coalesce(b.legal_name,''), coalesce(b.trade_name,''), coalesce(b.industry,''),
                       coalesce(b.category,''), coalesce(b.city,''), coalesce(b.country,''),
                       coalesce(b.description,'')))
                   like concat('%', lower(:q), '%'))
              and (:industry is null or lower(b.industry) = lower(:industry))
              and (:city is null or lower(b.city) = lower(:city))
              and (:state is null or lower(b.state) = lower(:state))
              and (:minRevenue is null or b.annual_revenue >= :minRevenue)
              and (:maxRevenue is null or b.annual_revenue < :maxRevenue)
            """,
            nativeQuery = true)
    Page<Business> searchListed(@Param("q") String q,
                                @Param("industry") String industry,
                                @Param("city") String city,
                                @Param("state") String state,
                                @Param("minRevenue") java.math.BigDecimal minRevenue,
                                @Param("maxRevenue") java.math.BigDecimal maxRevenue,
                                Pageable pageable);

    @Query(value = """
            select distinct b.industry from businesses b
            join users u on u.id = b.owner_user_id
            where u.status = 'ACTIVE'
              and b.admin_listing_status = 'LISTED'
              and b.listed_until > now()
              and b.industry is not null and b.industry <> ''
            order by 1
            """, nativeQuery = true)
    List<String> findListedIndustries();

    @Query(value = """
            select distinct b.state from businesses b
            join users u on u.id = b.owner_user_id
            where u.status = 'ACTIVE'
              and b.admin_listing_status = 'LISTED'
              and b.listed_until > now()
              and b.state is not null and b.state <> ''
            order by 1
            """, nativeQuery = true)
    List<String> findListedStates();

    /**
     * Public catalogue query. It matches free text only against non-identifying columns
     * (industry, category, city, state), so an anonymous visitor cannot probe for a company
     * by its legal or trade name.
     */
    @Query(value = """
            select b.* from businesses b
            join users u on u.id = b.owner_user_id
            where u.status = 'ACTIVE'
              and b.admin_listing_status = 'LISTED'
              and b.listed_until > now()
              and (:q is null or
                   lower(concat_ws(' ',
                       coalesce(b.industry,''), coalesce(b.category,''),
                       coalesce(b.city,''), coalesce(b.state,'')))
                   like concat('%', lower(:q), '%'))
              and (:industry is null or lower(b.industry) = lower(:industry))
              and (:city is null or lower(b.city) = lower(:city))
            order by b.listed_until desc, b.created_at desc
            """,
            countQuery = """
            select count(*)
            from businesses b
            join users u on u.id = b.owner_user_id
            where u.status = 'ACTIVE'
              and b.admin_listing_status = 'LISTED'
              and b.listed_until > now()
              and (:q is null or
                   lower(concat_ws(' ',
                       coalesce(b.industry,''), coalesce(b.category,''),
                       coalesce(b.city,''), coalesce(b.state,'')))
                   like concat('%', lower(:q), '%'))
              and (:industry is null or lower(b.industry) = lower(:industry))
              and (:city is null or lower(b.city) = lower(:city))
            """,
            nativeQuery = true)
    Page<Business> searchPublic(@Param("q") String q,
                                @Param("industry") String industry,
                                @Param("city") String city,
                                Pageable pageable);
}
