package com.example.directory.payment;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.example.directory.audit.AuditService;
import com.example.directory.common.ApiException;
import com.example.directory.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@ExtendWith(MockitoExtension.class)
class PaymentDashboardServiceTest {

    @Mock
    private PaymentRepository repository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private AuditService auditService;

    private PaymentDashboardService service;

    @BeforeEach
    void setUp() {
        service = new PaymentDashboardService(repository, userRepository, auditService);
    }

    @Test
    void metricsAggregateFromDatabasePerCurrency() {
        when(repository.countByStatus(PaymentStatus.PAID)).thenReturn(10L);
        when(repository.countByStatus(PaymentStatus.FAILED)).thenReturn(2L);
        when(repository.countByStatus(PaymentStatus.PENDING)).thenReturn(3L);
        when(repository.countByStatus(PaymentStatus.REFUNDED)).thenReturn(1L);
        when(repository.findDistinctCurrencies()).thenReturn(List.of("EUR", "INR"));
        when(repository.revenueByCurrencyBetween(any(), any()))
                .thenReturn(List.<Object[]>of(
                        new Object[]{"INR", new BigDecimal("1000.00")},
                        new Object[]{"EUR", new BigDecimal("25.00")}));

        PaymentDashboardService.DashboardMetrics metrics = service.getMetrics();

        assertThat(metrics.getRevenueByCurrency().get("total"))
                .containsEntry("INR", new BigDecimal("1000.00"))
                .containsEntry("EUR", new BigDecimal("25.00"));
        assertThat(metrics.getRevenueByCurrency().get("today")).containsKey("INR");
        assertThat(metrics.getRevenueByCurrency().get("week")).containsKey("INR");
        assertThat(metrics.getRevenueByCurrency().get("month")).containsKey("INR");
        assertThat(metrics.getCurrencies()).containsExactly("EUR", "INR");
        assertThat(metrics.getTotalTransactions()).isEqualTo(16);
        assertThat(metrics.getSuccessfulPayments()).isEqualTo(10);
        assertThat(metrics.getFailedPayments()).isEqualTo(2);
        assertThat(metrics.getPendingPayments()).isEqualTo(3);
        assertThat(metrics.getRefundedPayments()).isEqualTo(1);
        // 10 paid of 12 attempted (paid + failed)
        assertThat(metrics.getSuccessRate()).isEqualTo(83.33);
    }

    @Test
    void metricsHandleEmptyTable() {
        when(repository.countByStatus(any())).thenReturn(0L);
        when(repository.findDistinctCurrencies()).thenReturn(List.of());
        when(repository.revenueByCurrencyBetween(any(), any())).thenReturn(List.of());

        PaymentDashboardService.DashboardMetrics metrics = service.getMetrics();

        assertThat(metrics.getTotalTransactions()).isZero();
        assertThat(metrics.getSuccessRate()).isZero();
        assertThat(metrics.getRevenueByCurrency().get("total")).isEmpty();
        assertThat(metrics.getCurrencies()).isEmpty();
    }

    @Test
    void dailyAnalyticsReturnsOnePointPerDay() {
        when(repository.findDistinctCurrencies()).thenReturn(List.of("INR"));
        when(repository.calculateRevenueBetween(any(), any(), eq("INR")))
                .thenReturn(new BigDecimal("10.50"));

        PaymentDashboardService.RevenueAnalytics analytics = service.getAnalytics("daily", null, null, null);

        assertThat(analytics.getPeriod()).isEqualTo("daily");
        assertThat(analytics.getGranularity()).isEqualTo("day");
        assertThat(analytics.getCurrency()).isEqualTo("INR");
        assertThat(analytics.getPoints()).hasSize(30);
        assertThat(analytics.getPoints().get(0).getAmount()).isEqualByComparingTo("10.50");
        assertThat(analytics.getTotalRevenue()).isEqualByComparingTo("315.00");
    }

    @Test
    void analyticsHonoursRequestedCurrency() {
        when(repository.findDistinctCurrencies()).thenReturn(List.of("INR", "USD"));
        when(repository.calculateRevenueBetween(any(), any(), eq("USD"))).thenReturn(BigDecimal.ONE);

        PaymentDashboardService.RevenueAnalytics analytics = service.getAnalytics("weekly", null, null, "usd");

        assertThat(analytics.getCurrency()).isEqualTo("USD");
        assertThat(analytics.getPoints()).hasSize(12);
        assertThat(analytics.getGranularity()).isEqualTo("week");
    }

    @Test
    void monthlyAnalyticsReturnsTwelvePoints() {
        when(repository.findDistinctCurrencies()).thenReturn(List.of("INR"));
        when(repository.calculateRevenueBetween(any(), any(), eq("INR"))).thenReturn(BigDecimal.ZERO);

        PaymentDashboardService.RevenueAnalytics analytics = service.getAnalytics("monthly", null, null, null);

        assertThat(analytics.getPoints()).hasSize(12);
        assertThat(analytics.getGranularity()).isEqualTo("month");
    }

    @Test
    void customRangeBucketsByDayForShortWindow() {
        when(repository.findDistinctCurrencies()).thenReturn(List.of("INR"));
        when(repository.calculateRevenueBetween(any(), any(), eq("INR"))).thenReturn(BigDecimal.ZERO);

        PaymentDashboardService.RevenueAnalytics analytics =
                service.getAnalytics("custom", "2026-01-01", "2026-01-10", null);

        assertThat(analytics.getPoints()).hasSize(10);
        assertThat(analytics.getStart()).isEqualTo("2026-01-01");
        assertThat(analytics.getEnd()).isEqualTo("2026-01-10");
    }

    @Test
    void customRangeUsesWeeksForMediumWindow() {
        when(repository.findDistinctCurrencies()).thenReturn(List.of("INR"));
        when(repository.calculateRevenueBetween(any(), any(), eq("INR"))).thenReturn(BigDecimal.ZERO);

        PaymentDashboardService.RevenueAnalytics analytics =
                service.getAnalytics("custom", "2026-01-01", "2026-04-01", null);

        assertThat(analytics.getGranularity()).isEqualTo("week");
        assertThat(analytics.getPoints()).isNotEmpty();
    }

    @Test
    void customRangeRequiresDates() {
        assertThatThrownBy(() -> service.getAnalytics("custom", null, null, null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("required");
    }

    @Test
    void customRangeRejectsReversedDates() {
        assertThatThrownBy(() -> service.getAnalytics("custom", "2026-02-01", "2026-01-01", null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("on or before");
    }

    @Test
    void unknownPeriodIsRejected() {
        assertThatThrownBy(() -> service.getAnalytics("hourly", null, null, null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("period");
    }

    @Test
    void invalidCurrencyIsRejected() {
        when(repository.findDistinctCurrencies()).thenReturn(List.of("INR"));

        assertThatThrownBy(() -> service.getAnalytics("daily", null, null, "rupees"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("currency");
    }

    @Test
    void unknownStatusFilterIsRejected() {
        assertThatThrownBy(() -> service.getTransactions(0, 20, "settled", null, null, null, null, null, null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("status");
    }

    @Test
    void unknownSortFieldIsRejected() {
        assertThatThrownBy(() -> service.getTransactions(0, 20, null, null, null, null, null, "customerName", null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("sort");
    }

    @Test
    void malformedDateIsRejected() {
        assertThatThrownBy(() -> service.getTransactions(0, 20, null, "not-a-date", null, null, null, null, null))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("dateFrom");
    }

    @Test
    void detailsIncludeRefundAndGatewayInformation() {
        Payment payment = paidPayment();
        payment.setStatus(PaymentStatus.REFUNDED);
        payment.setRefundedAt(Instant.parse("2026-03-02T10:00:00Z"));
        payment.setRefundReason("Duplicate charge");
        when(repository.findById(payment.getId())).thenReturn(Optional.of(payment));
        when(userRepository.findById(payment.getUserId())).thenReturn(Optional.empty());

        Map<String, Object> detail = service.getTransactionDetails(payment.getId());

        assertThat(detail.get("status")).isEqualTo("refunded");
        assertThat(detail.get("refundReason")).isEqualTo("Duplicate charge");
        @SuppressWarnings("unchecked")
        Map<String, Object> refund = (Map<String, Object>) detail.get("refund");
        assertThat(refund).containsEntry("reason", "Duplicate charge").containsEntry("type", "full");
        @SuppressWarnings("unchecked")
        Map<String, Object> gateway = (Map<String, Object>) detail.get("gatewayResponse");
        assertThat(gateway).containsEntry("status", "refunded");
    }

    @Test
    void detailsThrowWhenPaymentMissing() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getTransactionDetails(id))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not found");
    }

    @Test
    @SuppressWarnings("unchecked")
    void exportRecordsAnAuditEntry() {
        when(repository.findAll(any(org.springframework.data.jpa.domain.Specification.class),
                any(org.springframework.data.domain.Sort.class)))
                .thenReturn(List.of(paidPayment()));

        List<Map<String, Object>> rows = service.exportTransactions(null, null, null, null, null);
        service.auditExport(UUID.randomUUID(), null, null, null, null, null, rows.size());

        assertThat(rows).hasSize(1);
        verify(auditService).record(any(), eq("PAYMENT_REPORT_EXPORTED"), eq("payment"),
                isNull(), isNull(), any());
    }

    private Payment paidPayment() {
        Payment payment = new Payment();
        payment.setId(UUID.randomUUID());
        payment.setUserId(UUID.randomUUID());
        payment.setPurpose(PaymentPurpose.LISTING);
        payment.setAmount(new BigDecimal("199.00"));
        payment.setCurrency("INR");
        payment.setProvider("MANUAL");
        payment.setProviderRef("GW-123");
        payment.setStatus(PaymentStatus.PAID);
        payment.setCreatedAt(Instant.parse("2026-03-01T09:00:00Z"));
        payment.setPaidAt(Instant.parse("2026-03-01T09:01:00Z"));
        return payment;
    }
}
