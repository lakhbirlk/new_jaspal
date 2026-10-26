package com.example.directory.business;

import com.example.directory.audit.AuditService;
import com.example.directory.auth.AuthPrincipal;
import com.example.directory.common.ApiException;
import com.example.directory.common.CryptoService;
import com.example.directory.common.PageResult;
import com.example.directory.document.DocumentRepository;
import com.example.directory.document.DocumentService;
import com.example.directory.listing.ListingStatus;
import com.example.directory.listing.ListingStatusService;
import com.example.directory.policy.PolicyEngine;
import com.example.directory.policy.UnlockState;
import com.example.directory.search.ResearchAccessLog;
import com.example.directory.search.ResearchAccessLogRepository;
import com.example.directory.user.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.*;

@Service
@RequiredArgsConstructor
public class BusinessService {

    private final BusinessRepository businessRepository;
    private final UserRepository userRepository;
    private final PolicyEngine policyEngine;
    private final CryptoService cryptoService;
    private final DocumentRepository documentRepository;
    private final DocumentService documentService;
    private final ListingStatusService listingStatusService;
    private final ProfileCompletionService completionService;
    private final ResearchAccessLogRepository accessLogRepository;
    private final AuditService auditService;

    public Map<String, Object> myBusiness(AuthPrincipal principal) {
        Business business = requireOwned(principal.id());
        Map<String, Object> map = policyEngine.filterOutput(map(business, true), principal,
                "business", UnlockState.ANY);
        map.put("profile_completion", completionService.completion(requireUser(principal.id())));
        return map;
    }

    @Transactional
    public Map<String, Object> updateMyBusiness(AuthPrincipal principal, Map<String, Object> payload) {
        User user = requireUser(principal.id());
        if (user.getStatus() == UserStatus.PENDING_REVIEW) {
            throw ApiException.conflict("PROFILE_UNDER_REVIEW",
                    "Your business cannot be edited while it is under review");
        }
        if (user.getStatus() == UserStatus.SUSPENDED) {
            throw ApiException.forbidden("ACCOUNT_SUSPENDED", "This account is suspended");
        }
        if (user.getStatus() == UserStatus.PENDING_EMAIL) {
            throw ApiException.forbidden("EMAIL_NOT_VERIFIED", "Verify your email first");
        }
        Business business = requireOwned(principal.id());
        Map<String, Object> before = map(business, true);
        policyEngine.filterInput(payload, principal, "business");
        applyFields(business, payload, false);
        businessRepository.save(business);
        Map<String, Object> after = map(business, true);
        auditService.record(principal.id(), "BUSINESS_UPDATED", "business", business.getId(),
                before, after);
        Map<String, Object> result = policyEngine.filterOutput(after, principal,
                "business", UnlockState.ANY);
        result.put("profile_completion", completionService.completion(user));
        return result;
    }

    public Map<String, Object> detail(AuthPrincipal principal, UUID businessId) {
        Business business = businessRepository.findById(businessId)
                .orElseThrow(() -> ApiException.notFound("BUSINESS_NOT_FOUND", "Business not found"));

        switch (principal.role()) {
            case RESEARCHER -> {
                if (!listingStatusService.visibleToResearchers(business)) {
                    throw ApiException.notFound("BUSINESS_NOT_FOUND", "Business not found");
                }
                logAccess(principal.id(), businessId, "detail");
            }
            case BUSINESS -> {
                if (!principal.id().equals(business.getOwnerUserId())) {
                    throw ApiException.notFound("BUSINESS_NOT_FOUND", "Business not found");
                }
            }
            case AUDITOR -> auditService.record(principal.id(), "AUDITOR_VIEWED_BUSINESS",
                    "business", businessId, null, null);
            case ADMIN -> {
            }
        }

        UnlockState state = policyEngine.unlockState(principal, "business", businessId);
        Map<String, Object> map = map(business, principal.role() != Role.RESEARCHER);
        return policyEngine.filterOutput(map, principal, "business", state);
    }

    /**
     * Anonymised catalogue of currently listed businesses for anonymous visitors. It exposes
     * enough to browse and shortlist but never enough to identify, contact or trade with a
     * company; identity, contacts, statements and detail remain behind researcher access.
     */
    public PageResult<Map<String, Object>> publicList(String q, String industry, String city,
                                                      int page, int size) {
        Page<Business> result = businessRepository.searchPublic(
                normalizeFilter(q), normalizeFilter(industry), normalizeFilter(city),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50)));
        return PageResult.of(result, result.getContent().stream().map(this::publicMap).toList());
    }

    public Map<String, Object> publicDetail(UUID businessId) {
        Business business = businessRepository.findById(businessId)
                .orElseThrow(() -> ApiException.notFound("BUSINESS_NOT_FOUND", "Business not found"));
        if (!listingStatusService.visibleToResearchers(business)) {
            throw ApiException.notFound("BUSINESS_NOT_FOUND", "Business not found");
        }
        return publicMap(business);
    }

    private Map<String, Object> publicMap(Business business) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", business.getId());
        map.put("public_code", publicCode(business.getId()));
        map.put("industry", business.getIndustry());
        map.put("category", business.getCategory());
        map.put("city", business.getCity());
        map.put("state", business.getState());
        map.put("country", business.getCountry());
        map.put("employee_count", business.getEmployeeCount());
        map.put("annual_revenue", business.getAnnualRevenue());
        return map;
    }

    private String publicCode(UUID id) {
        return "DOB-" + id.toString().substring(0, 6).toUpperCase(Locale.ROOT);
    }

    private String normalizeFilter(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public PageResult<Map<String, Object>> auditorList(String q, int page, int size,
                                                       AuthPrincipal principal) {
        Page<Business> result = businessRepository.findAll(searchSpecification(q),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                        Sort.by(Sort.Direction.ASC, "legalName")));
        List<Map<String, Object>> items = result.getContent().stream()
                .map(business -> policyEngine.filterOutput(map(business, true), principal,
                        "business", UnlockState.ANY))
                .toList();
        return PageResult.of(result, items);
    }

    public PageResult<Map<String, Object>> adminList(String q, String verificationValue,
                                                     String listingValue, int page, int size,
                                                     AuthPrincipal principal) {
        VerificationStatus verification = verificationValue == null || verificationValue.isBlank()
                ? null : parseVerification(verificationValue);
        ListingStatus listing = listingValue == null || listingValue.isBlank()
                ? null : parseListingStatus(listingValue);
        Specification<Business> specification = searchSpecification(q);
        if (verification != null) {
            specification = specification.and((root, query, cb) ->
                    cb.equal(root.get("verificationStatus"), verification));
        }

        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        if (listing == null) {
            Page<Business> result = businessRepository.findAll(specification,
                    PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt")));
            List<Map<String, Object>> items = result.getContent().stream()
                    .map(business -> adminMap(business, principal, false)).toList();
            return PageResult.of(result, items);
        }

        List<Business> all = businessRepository.findAll(specification,
                Sort.by(Sort.Direction.DESC, "createdAt"));
        List<Business> filtered = all.stream()
                .filter(business -> listingStatusService.statusOf(business) == listing)
                .toList();
        int from = Math.min(safePage * safeSize, filtered.size());
        int to = Math.min(from + safeSize, filtered.size());
        List<Map<String, Object>> items = filtered.subList(from, to).stream()
                .map(business -> adminMap(business, principal, false)).toList();
        int totalPages = safeSize == 0 ? 0 : (int) Math.ceil(filtered.size() / (double) safeSize);
        return new PageResult<>(items, safePage, safeSize, filtered.size(), totalPages);
    }

    public Map<String, Object> adminDetail(UUID id, AuthPrincipal principal) {
        Business business = businessRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("BUSINESS_NOT_FOUND", "Business not found"));
        return adminMap(business, principal, true);
    }

    @Transactional
    public Map<String, Object> adminUpdate(UUID id, Map<String, Object> payload,
                                           AuthPrincipal principal) {
        Business business = businessRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("BUSINESS_NOT_FOUND", "Business not found"));
        Map<String, Object> before = map(business, true);
        policyEngine.filterInput(payload, principal, "business");
        applyFields(business, payload, true);
        businessRepository.save(business);
        Map<String, Object> after = map(business, true);
        auditService.record(principal.id(), "BUSINESS_ADMIN_UPDATED", "business", id, before, after);
        return adminMap(business, principal, true);
    }

    public Map<String, Object> map(Business business, boolean includeDocuments) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", business.getId());
        map.put("owner_user_id", business.getOwnerUserId());
        map.put("legal_name", business.getLegalName());
        map.put("trade_name", business.getTradeName());
        map.put("registration_number", business.getRegistrationNumber());
        map.put("tax_id", cryptoService.decrypt(business.getTaxId()));
        map.put("industry", business.getIndustry());
        map.put("category", business.getCategory());
        map.put("address_line", business.getAddressLine());
        map.put("city", business.getCity());
        map.put("state", business.getState());
        map.put("country", business.getCountry());
        map.put("postal_code", business.getPostalCode());
        map.put("website", business.getWebsite());
        map.put("public_email", business.getPublicEmail());
        map.put("public_phone", business.getPublicPhone());
        map.put("contact_person_name", business.getContactPersonName());
        map.put("contact_person_phone", business.getContactPersonPhone());
        map.put("annual_revenue", business.getAnnualRevenue());
        map.put("employee_count", business.getEmployeeCount());
        map.put("bank_details", cryptoService.decrypt(business.getBankDetails()));
        map.put("description", business.getDescription());
        map.put("verification_status", business.getVerificationStatus().name().toLowerCase(Locale.ROOT));
        map.put("listed_until", business.getListedUntil());
        map.put("admin_listing_status", business.getAdminListingStatus().name().toLowerCase(Locale.ROOT));
        map.put("listing_status", listingStatusService.statusOf(business).apiValue());
        map.put("created_at", business.getCreatedAt());
        map.put("updated_at", business.getUpdatedAt());
        if (includeDocuments) {
            map.put("documents", documentRepository.findSummariesByBusiness(business.getId())
                    .stream().map(documentService::summaryMap).toList());
        }
        return map;
    }

    private Map<String, Object> adminMap(Business business, AuthPrincipal principal,
                                         boolean includeDocuments) {
        Map<String, Object> filtered = policyEngine.filterOutputForRole(map(business, includeDocuments),
                principal.role(), principal.id(), "business", UnlockState.ANY);
        userRepository.findById(business.getOwnerUserId() == null ? UUID.randomUUID()
                        : business.getOwnerUserId())
                .ifPresent(owner -> {
                    Map<String, Object> ownerInfo = new LinkedHashMap<>();
                    ownerInfo.put("id", owner.getId());
                    ownerInfo.put("email", owner.getEmail());
                    ownerInfo.put("fullName", owner.getFullName());
                    ownerInfo.put("status", owner.getStatus().apiValue());
                    filtered.put("owner", ownerInfo);
                });
        return filtered;
    }

    private void applyFields(Business business, Map<String, Object> payload, boolean admin) {
        for (Map.Entry<String, Object> entry : payload.entrySet()) {
            String field = entry.getKey();
            Object value = entry.getValue();
            switch (field) {
                case "legal_name" -> {
                    String text = requiredText(value, "legal_name");
                    business.setLegalName(text);
                }
                case "trade_name" -> business.setTradeName(text(value));
                case "registration_number" -> business.setRegistrationNumber(text(value));
                case "tax_id" -> business.setTaxId(encrypt(text(value)));
                case "industry" -> business.setIndustry(text(value));
                case "category" -> business.setCategory(text(value));
                case "address_line" -> business.setAddressLine(text(value));
                case "city" -> business.setCity(text(value));
                case "state" -> business.setState(text(value));
                case "country" -> business.setCountry(text(value));
                case "postal_code" -> business.setPostalCode(text(value));
                case "website" -> business.setWebsite(validateUrl(text(value)));
                case "public_email" -> business.setPublicEmail(validateEmail(text(value)));
                case "public_phone" -> business.setPublicPhone(validatePhone(text(value)));
                case "contact_person_name" -> business.setContactPersonName(text(value));
                case "contact_person_phone" -> business.setContactPersonPhone(validatePhone(text(value)));
                case "annual_revenue" -> business.setAnnualRevenue(decimal(value));
                case "employee_count" -> business.setEmployeeCount(integer(value));
                case "bank_details" -> business.setBankDetails(encrypt(text(value)));
                case "description" -> business.setDescription(text(value));
                case "verification_status" -> {
                    if (!admin) throw ApiException.fieldForbidden(field);
                    business.setVerificationStatus(parseVerification(String.valueOf(value)));
                }
                case "admin_listing_status" -> {
                    if (!admin) throw ApiException.fieldForbidden(field);
                    business.setAdminListingStatus(parseAdminListing(String.valueOf(value)));
                }
                case "listed_until" -> {
                    if (!admin) throw ApiException.fieldForbidden(field);
                    business.setListedUntil(value == null ? null : parseInstant(value));
                }
                case "owner_user_id" -> {
                    if (!admin) throw ApiException.fieldForbidden(field);
                    business.setOwnerUserId(assignableOwner(value));
                }
                default -> throw ApiException.badRequest("FIELD_NOT_UPDATABLE",
                        "Field cannot be updated through this endpoint: " + field);
            }
        }
    }

    private UUID assignableOwner(Object value) {
        if (value == null) {
            return null;
        }
        UUID userId;
        try {
            userId = UUID.fromString(value.toString());
        } catch (Exception ex) {
            throw ApiException.badRequest("INVALID_OWNER", "owner_user_id must be a UUID");
        }
        User user = requireUser(userId);
        if (user.getRole() != Role.BUSINESS) {
            throw ApiException.badRequest("INVALID_OWNER", "The owner must have the business role");
        }
        businessRepository.findByOwnerUserId(userId).ifPresent(existing -> {
            throw ApiException.conflict("OWNER_ALREADY_LINKED",
                    "That user already owns a business");
        });
        return userId;
    }

    private void logAccess(UUID researcherId, UUID businessId, String query) {
        ResearchAccessLog log = new ResearchAccessLog();
        log.setResearcherUserId(researcherId);
        log.setBusinessId(businessId);
        log.setQuery(query);
        accessLogRepository.save(log);
    }

    private Business requireOwned(UUID userId) {
        return businessRepository.findByOwnerUserId(userId)
                .orElseThrow(() -> ApiException.notFound("BUSINESS_NOT_FOUND",
                        "No business is associated with this account"));
    }

    private User requireUser(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "User not found"));
    }

    private Specification<Business> searchSpecification(String q) {
        String query = q == null ? null : q.trim().toLowerCase(Locale.ROOT);
        return (root, criteriaQuery, cb) -> {
            if (query == null || query.isEmpty()) {
                return cb.conjunction();
            }
            String like = "%" + query + "%";
            return cb.or(
                    cb.like(cb.lower(root.get("legalName")), like),
                    cb.like(cb.lower(root.get("tradeName")), like),
                    cb.like(cb.lower(root.get("registrationNumber")), like),
                    cb.like(cb.lower(root.get("city")), like),
                    cb.like(cb.lower(root.get("publicEmail")), like));
        };
    }

    private String text(Object value) {
        if (value == null) return null;
        String text = value.toString().trim();
        return text.isEmpty() ? null : text;
    }

    private String requiredText(Object value, String field) {
        String text = text(value);
        if (text == null) {
            throw ApiException.badRequest("REQUIRED_FIELD", field + " cannot be empty");
        }
        return text;
    }

    private String encrypt(String value) {
        return value == null ? null : cryptoService.encrypt(value);
    }

    private BigDecimal decimal(Object value) {
        if (value == null || value.toString().isBlank()) return null;
        try {
            BigDecimal number = new BigDecimal(value.toString());
            if (number.signum() < 0) throw new NumberFormatException();
            return number;
        } catch (Exception ex) {
            throw ApiException.badRequest("INVALID_NUMBER", "annual_revenue must be a positive number");
        }
    }

    private Integer integer(Object value) {
        if (value == null || value.toString().isBlank()) return null;
        try {
            int number = Integer.parseInt(value.toString());
            if (number < 0) throw new NumberFormatException();
            return number;
        } catch (Exception ex) {
            throw ApiException.badRequest("INVALID_NUMBER", "employee_count must be a positive integer");
        }
    }

    private String validateEmail(String value) {
        if (value == null) return null;
        if (!value.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw ApiException.badRequest("INVALID_EMAIL", "public_email is not a valid email");
        }
        return value;
    }

    private String validatePhone(String value) {
        if (value == null) return null;
        if (!value.matches("^[+0-9 ()-]{6,40}$")) {
            throw ApiException.badRequest("INVALID_PHONE", "Phone number is not valid");
        }
        return value;
    }

    private String validateUrl(String value) {
        if (value == null) return null;
        if (!value.matches("^https?://.+")) {
            throw ApiException.badRequest("INVALID_URL", "website must start with http:// or https://");
        }
        return value;
    }

    private Instant parseInstant(Object value) {
        try {
            return Instant.parse(value.toString());
        } catch (DateTimeParseException ex) {
            throw ApiException.badRequest("INVALID_DATE", "listed_until must be an ISO-8601 instant");
        }
    }

    private VerificationStatus parseVerification(String value) {
        try {
            return VerificationStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            throw ApiException.badRequest("INVALID_STATUS",
                    "verification_status must be unverified, verified or rejected");
        }
    }

    private AdminListingStatus parseAdminListing(String value) {
        try {
            return AdminListingStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            throw ApiException.badRequest("INVALID_STATUS",
                    "admin_listing_status must be listed or unlisted");
        }
    }

    private ListingStatus parseListingStatus(String value) {
        try {
            return ListingStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            throw ApiException.badRequest("INVALID_STATUS", "Unknown listing status");
        }
    }
}
