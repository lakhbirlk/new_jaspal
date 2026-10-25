package com.example.directory.policy;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class MaskingServiceTest {

    private final MaskingService maskingService = new MaskingService();

    @Test
    void identifiersKeepOnlyTheLastFourCharacters() {
        assertThat(maskingService.mask("registration_number", "U74999MH2019PTC123456"))
                .isEqualTo("****3456");
        assertThat(maskingService.mask("tax_id", "AAAPZ1234C")).isEqualTo("****234C");
        assertThat(maskingService.mask("bank_details", "HDFC-000123456789"))
                .isEqualTo("****6789");
    }

    @Test
    void shortIdentifiersAreFullyMasked() {
        assertThat(maskingService.mask("tax_id", "ABC")).isEqualTo("****");
        assertThat(maskingService.mask("public_phone", "1234")).isEqualTo("****");
    }

    @Test
    void phoneNumbersKeepTheLastFourDigits() {
        assertThat(maskingService.mask("contact_person_phone", "+91 90000 12345"))
                .isEqualTo("****2345");
    }

    @Test
    void revenueIsReducedToABand() {
        assertThat(maskingService.mask("annual_revenue", new BigDecimal("500000")))
                .isEqualTo("Under 1M");
        assertThat(maskingService.mask("annual_revenue", new BigDecimal("2500000")))
                .isEqualTo("1M to 5M");
        assertThat(maskingService.mask("annual_revenue", new BigDecimal("7500000")))
                .isEqualTo("5M to 10M");
        assertThat(maskingService.mask("annual_revenue", new BigDecimal("25000000")))
                .isEqualTo("10M to 50M");
        assertThat(maskingService.mask("annual_revenue", new BigDecimal("60000000")))
                .isEqualTo("50M and above");
    }

    @Test
    void employeeCountIsReducedToABand() {
        assertThat(maskingService.mask("employee_count", 5)).isEqualTo("1 to 9");
        assertThat(maskingService.mask("employee_count", 25)).isEqualTo("10 to 49");
        assertThat(maskingService.mask("employee_count", 100)).isEqualTo("50 to 249");
        assertThat(maskingService.mask("employee_count", 500)).isEqualTo("250 to 999");
        assertThat(maskingService.mask("employee_count", 5000)).isEqualTo("1000 and above");
    }

    @Test
    void unknownFieldsAreFullyMaskedAndNullStaysNull() {
        assertThat(maskingService.mask("website", "https://example.com")).isEqualTo("****");
        assertThat(maskingService.mask("website", null)).isNull();
        assertThat(maskingService.mask("annual_revenue", "not-a-number")).isEqualTo("****");
    }
}
