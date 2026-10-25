package com.example.directory.user;

import com.example.directory.business.Business;
import com.example.directory.business.BusinessRepository;
import com.example.directory.common.ApiException;
import com.example.directory.document.DocumentRepository;
import com.example.directory.document.DocumentStatus;
import com.example.directory.document.DocumentType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ProfileCompletionService {

    private final ProfileRequirementRepository requirementRepository;
    private final ResearcherProfileRepository profileRepository;
    private final BusinessRepository businessRepository;
    private final DocumentRepository documentRepository;

    public Map<String, Object> completion(User user) {
        List<ProfileRequirement> requirements = requirementRepository
                .findByRoleOrderByKindAscNameAsc(user.getRole());
        Map<String, Object> fields = storedFields(user);
        Business business = user.getRole() == Role.BUSINESS
                ? businessRepository.findByOwnerUserId(user.getId()).orElse(null) : null;

        int required = 0;
        int present = 0;
        List<Map<String, Object>> missing = new ArrayList<>();

        for (ProfileRequirement requirement : requirements) {
            if (!requirement.isRequired()) {
                continue;
            }
            required++;
            if (requirement.getKind() == ProfileRequirement.Kind.FIELD) {
                if (hasValue(fields.get(requirement.getName()))) {
                    present++;
                } else {
                    missing.add(Map.of("kind", "field", "name", requirement.getName()));
                }
            } else {
                DocumentType type = parseDocumentType(requirement.getName());
                long uploaded = type == null ? 0
                        : documentRepository.countPresentDocuments(user.getId(), type,
                        DocumentStatus.REJECTED);
                if (uploaded > 0) {
                    present++;
                } else {
                    missing.add(Map.of("kind", "document", "name", requirement.getName()));
                }
            }
        }

        int percent = required == 0 ? 100 : (int) Math.round(present * 100.0 / required);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("percent", percent);
        result.put("required", required);
        result.put("present", present);
        result.put("missing", missing);
        result.put("complete", missing.isEmpty());
        result.put("status", user.getStatus().apiValue());
        result.put("businessId", business == null ? null : business.getId());
        if (user.getStatus() == UserStatus.REJECTED) {
            result.put("reviewNote", user.getReviewNote());
        }
        return result;
    }

    public List<Map<String, Object>> missingItems(User user) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> missing = (List<Map<String, Object>>) completion(user).get("missing");
        return missing;
    }

    public Map<String, Object> storedFields(User user) {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("full_name", user.getFullName());
        fields.put("email", user.getEmail());

        if (user.getRole() == Role.RESEARCHER) {
            profileRepository.findById(user.getId()).ifPresent(profile -> {
                fields.put("full_name", profile.getFullName());
                fields.put("organization", profile.getOrganization());
                fields.put("designation", profile.getDesignation());
                fields.put("phone", profile.getPhone());
                fields.put("purpose_of_research", profile.getPurposeOfResearch());
            });
        }

        if (user.getRole() == Role.BUSINESS) {
            businessRepository.findByOwnerUserId(user.getId()).ifPresent(business -> {
                fields.put("legal_name", business.getLegalName());
                fields.put("trade_name", business.getTradeName());
                fields.put("registration_number", business.getRegistrationNumber());
                fields.put("tax_id", business.getTaxId());
                fields.put("industry", business.getIndustry());
                fields.put("category", business.getCategory());
                fields.put("address_line", business.getAddressLine());
                fields.put("city", business.getCity());
                fields.put("state", business.getState());
                fields.put("country", business.getCountry());
                fields.put("postal_code", business.getPostalCode());
                fields.put("website", business.getWebsite());
                fields.put("public_email", business.getPublicEmail());
                fields.put("public_phone", business.getPublicPhone());
                fields.put("contact_person_name", business.getContactPersonName());
                fields.put("contact_person_phone", business.getContactPersonPhone());
                fields.put("annual_revenue", business.getAnnualRevenue());
                fields.put("employee_count", business.getEmployeeCount());
                fields.put("bank_details", business.getBankDetails());
                fields.put("description", business.getDescription());
            });
        }
        return fields;
    }

    private boolean hasValue(Object value) {
        if (value == null) return false;
        if (value instanceof String text) return !text.isBlank();
        if (value instanceof BigDecimal number) return number.signum() != 0;
        if (value instanceof Number number) return number.doubleValue() != 0;
        return true;
    }

    private DocumentType parseDocumentType(String value) {
        try {
            return DocumentType.from(value);
        } catch (Exception ex) {
            return null;
        }
    }
}
