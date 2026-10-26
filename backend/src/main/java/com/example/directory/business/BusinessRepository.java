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
              and (cast(:q as text) is null or
                   to_tsvector('english',
                       coalesce(b.legal_name,'') || ' ' || coalesce(b.trade_name,'') || ' ' ||
                       coalesce(b.industry,'') || ' ' || coalesce(b.category,'') || ' ' ||
                       coalesce(b.city,'') || ' ' || coalesce(b.country,'') || ' ' ||
                       coalesce(b.description,''))
                   @@ plainto_tsquery('english', cast(:q as text)))
              and (cast(:industry as text) is null or lower(b.industry) = lower(cast(:industry as text)))
              and (cast(:city as text) is null or lower(b.city) = lower(cast(:city as text)))
            """,
            countQuery = """
            select count(*)
            from businesses b
            join users u on u.id = b.owner_user_id
            where u.status = 'ACTIVE'
              and b.admin_listing_status = 'LISTED'
              and b.listed_until > now()
              and (cast(:q as text) is null or
                   to_tsvector('english',
                       coalesce(b.legal_name,'') || ' ' || coalesce(b.trade_name,'') || ' ' ||
                       coalesce(b.industry,'') || ' ' || coalesce(b.category,'') || ' ' ||
                       coalesce(b.city,'') || ' ' || coalesce(b.country,'') || ' ' ||
                       coalesce(b.description,''))
                   @@ plainto_tsquery('english', cast(:q as text)))
              and (cast(:industry as text) is null or lower(b.industry) = lower(cast(:industry as text)))
              and (cast(:city as text) is null or lower(b.city) = lower(cast(:city as text)))
            """,
            nativeQuery = true)
    Page<Business> searchListed(@Param("q") String q,
                                @Param("industry") String industry,
                                @Param("city") String city,
                                Pageable pageable);

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
              and (cast(:q as text) is null or
                   lower(coalesce(b.industry,'') || ' ' || coalesce(b.category,'') || ' ' ||
                         coalesce(b.city,'') || ' ' || coalesce(b.state,''))
                   like '%' || lower(cast(:q as text)) || '%')
              and (cast(:industry as text) is null or lower(b.industry) = lower(cast(:industry as text)))
              and (cast(:city as text) is null or lower(b.city) = lower(cast(:city as text)))
            order by b.listed_until desc, b.created_at desc
            """,
            countQuery = """
            select count(*)
            from businesses b
            join users u on u.id = b.owner_user_id
            where u.status = 'ACTIVE'
              and b.admin_listing_status = 'LISTED'
              and b.listed_until > now()
              and (cast(:q as text) is null or
                   lower(coalesce(b.industry,'') || ' ' || coalesce(b.category,'') || ' ' ||
                         coalesce(b.city,'') || ' ' || coalesce(b.state,''))
                   like '%' || lower(cast(:q as text)) || '%')
              and (cast(:industry as text) is null or lower(b.industry) = lower(cast(:industry as text)))
              and (cast(:city as text) is null or lower(b.city) = lower(cast(:city as text)))
            """,
            nativeQuery = true)
    Page<Business> searchPublic(@Param("q") String q,
                                @Param("industry") String industry,
                                @Param("city") String city,
                                Pageable pageable);
}
