package com.example.directory.policy;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Set;

@Component
public class MaskingService {

    private static final Set<String> PHONE_FIELDS = Set.of(
            "contact_person_phone", "public_phone", "phone");

    public Object mask(String field, Object value) {
        if (value == null) {
            return null;
        }
        return switch (field) {
            case "registration_number", "tax_id" -> lastFour(value.toString());
            case "bank_details" -> lastFour(value.toString());
            case "annual_revenue" -> revenueBand(value);
            case "employee_count" -> employeeBand(value);
            default -> {
                if (PHONE_FIELDS.contains(field)) {
                    yield lastFour(value.toString());
                }
                yield "****";
            }
        };
    }

    private String lastFour(String value) {
        String compact = value.strip();
        if (compact.length() <= 4) {
            return "****";
        }
        return "****" + compact.substring(compact.length() - 4);
    }

    private String revenueBand(Object value) {
        try {
            BigDecimal amount = value instanceof BigDecimal decimal
                    ? decimal : new BigDecimal(value.toString());
            if (amount.compareTo(new BigDecimal("1000000")) < 0) return "Under 1M";
            if (amount.compareTo(new BigDecimal("5000000")) < 0) return "1M to 5M";
            if (amount.compareTo(new BigDecimal("10000000")) < 0) return "5M to 10M";
            if (amount.compareTo(new BigDecimal("50000000")) < 0) return "10M to 50M";
            return "50M and above";
        } catch (Exception ex) {
            return "****";
        }
    }

    private String employeeBand(Object value) {
        try {
            int count = Integer.parseInt(value.toString());
            if (count < 10) return "1 to 9";
            if (count < 50) return "10 to 49";
            if (count < 250) return "50 to 249";
            if (count < 1000) return "250 to 999";
            return "1000 and above";
        } catch (Exception ex) {
            return "****";
        }
    }
}
