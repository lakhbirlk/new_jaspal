package com.example.directory.payment;

import com.example.directory.audit.AuditService;
import com.example.directory.common.ApiException;
import com.example.directory.common.PageResult;
import com.example.directory.user.User;
import com.example.directory.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Read model for the admin payment dashboard. Every figure is aggregated in the database
 * from {@code payments}; nothing is mocked or estimated.
 *
 * <p>Revenue is only recognised for {@link PaymentStatus#PAID} rows. A full refund moves the
 * row to {@link PaymentStatus#REFUNDED}, which removes it from revenue and keeps the original
 * attempt visible in the transaction log, so retries and duplicate gateway events captured on
 * one payment row are never counted twice.
 */
@Service
@RequiredArgsConstructor
public class PaymentDashboardService {

    private static final ZoneId DEFAULT_ZONE = ZoneId.of("UTC");
    private static final int MAX_PAGE_SIZE = 100;

    private final PaymentRepository repository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    // ------------------------------------------------------------------ metrics

    @Transactional(readOnly = true)
    public DashboardMetrics getMetrics() {
        ZonedDateTime now = ZonedDateTime.now(DEFAULT_ZONE);
        Instant dayStart = now.toLocalDate().atStartOfDay(DEFAULT_ZONE).toInstant();
        Instant weekStart = now.toLocalDate()
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .atStartOfDay(DEFAULT_ZONE).toInstant();
        Instant monthStart = now.toLocalDate()
                .with(TemporalAdjusters.firstDayOfMonth())
                .atStartOfDay(DEFAULT_ZONE).toInstant();
        Instant tomorrow = now.toLocalDate().plusDays(1).atStartOfDay(DEFAULT_ZONE).toInstant();

        long paid = count(PaymentStatus.PAID);
        long failed = count(PaymentStatus.FAILED);
        long pending = count(PaymentStatus.PENDING);
        long refunded = count(PaymentStatus.REFUNDED);
        long attempted = paid + failed;

        DashboardMetrics metrics = new DashboardMetrics();
        metrics.setRevenueByCurrency(Map.of(
                "total", revenueBetween(Instant.EPOCH, tomorrow),
                "today", revenueBetween(dayStart, tomorrow),
                "week", revenueBetween(weekStart, tomorrow),
                "month", revenueBetween(monthStart, tomorrow)));
        metrics.setCurrencies(repository.findDistinctCurrencies());
        metrics.setTotalTransactions(paid + failed + pending + refunded);
        metrics.setSuccessfulPayments(paid);
        metrics.setFailedPayments(failed);
        metrics.setPendingPayments(pending);
        metrics.setRefundedPayments(refunded);
        metrics.setSuccessRate(attempted == 0
                ? 0.0
                : BigDecimal.valueOf(paid * 100.0 / attempted).setScale(2, RoundingMode.HALF_UP).doubleValue());
        return metrics;
    }

    private long count(PaymentStatus status) {
        Long value = repository.countByStatus(status);
        return value == null ? 0L : value;
    }

    /** Revenue for every currency seen in [from, to); currencies are never summed together. */
    private Map<String, BigDecimal> revenueBetween(Instant from, Instant to) {
        Map<String, BigDecimal> byCurrency = new TreeMap<>();
        for (Object[] row : repository.revenueByCurrencyBetween(from, to)) {
            String currency = (String) row[0];
            BigDecimal amount = (BigDecimal) row[1];
            byCurrency.put(currency, amount == null ? BigDecimal.ZERO : amount);
        }
        return byCurrency;
    }

    private BigDecimal revenueBetween(Instant from, Instant to, String currency) {
        if (currency == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal value = repository.calculateRevenueBetween(from, to, currency);
        return value == null ? BigDecimal.ZERO : value;
    }

    // ------------------------------------------------------------------ analytics

    /**
     * Revenue series for the requested window.
     *
     * @param period  one of {@code daily}, {@code weekly}, {@code monthly}, {@code custom}
     * @param from    custom range start (ISO date, inclusive); required for {@code custom}
     * @param to      custom range end (ISO date, inclusive); required for {@code custom}
     */
    @Transactional(readOnly = true)
    public RevenueAnalytics getAnalytics(String period, String from, String to, String currency) {
        String normalised = period == null || period.isBlank() ? "daily" : period.trim().toLowerCase(Locale.ROOT);
        LocalDate today = LocalDate.now(DEFAULT_ZONE);
        LocalDate start;
        LocalDate end;

        switch (normalised) {
            case "daily" -> {
                start = today.minusDays(29);
                end = today;
            }
            case "weekly" -> {
                start = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(11);
                end = today;
            }
            case "monthly" -> {
                start = today.with(TemporalAdjusters.firstDayOfMonth()).minusMonths(11);
                end = today;
            }
            case "custom" -> {
                start = parseDate(from, "from");
                end = parseDate(to, "to");
                if (start.isAfter(end)) {
                    throw ApiException.badRequest("INVALID_DATE_RANGE", "'from' must be on or before 'to'");
                }
                if (ChronoUnit.DAYS.between(start, end) > 366 * 2) {
                    throw ApiException.badRequest("RANGE_TOO_LARGE", "Date range cannot exceed two years");
                }
            }
            default -> throw ApiException.badRequest("INVALID_PERIOD",
                    "period must be daily, weekly, monthly or custom");
        }

        String selectedCurrency = resolveCurrency(currency);
        Granularity granularity = chooseGranularity(normalised, start, end);
        List<RevenuePoint> points = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;

        LocalDate cursor = bucketStart(start, granularity);
        while (!cursor.isAfter(end)) {
            LocalDate bucketEnd = bucketEnd(cursor, granularity);
            Instant fromInstant = cursor.atStartOfDay(DEFAULT_ZONE).toInstant();
            Instant toInstant = bucketEnd.atStartOfDay(DEFAULT_ZONE).toInstant();
            BigDecimal amount = revenueBetween(fromInstant, toInstant, selectedCurrency);
            total = total.add(amount);
            points.add(new RevenuePoint(labelFor(cursor, granularity, bucketEnd), cursor.toString(), amount));
            cursor = bucketEnd;
        }

        RevenueAnalytics analytics = new RevenueAnalytics();
        analytics.setPeriod(normalised);
        analytics.setGranularity(granularity.name().toLowerCase(Locale.ROOT));
        analytics.setStart(start.toString());
        analytics.setEnd(end.toString());
        analytics.setCurrency(selectedCurrency);
        analytics.setCurrencies(repository.findDistinctCurrencies());
        analytics.setTotalRevenue(total);
        analytics.setPoints(points);
        return analytics;
    }

    /**
     * Charts are always drawn for one currency. When the caller does not choose one, use the
     * first currency present in the ledger so the series stays comparable.
     */
    private String resolveCurrency(String requested) {
        List<String> available = repository.findDistinctCurrencies();
        if (requested != null && !requested.isBlank()) {
            String code = requested.trim().toUpperCase(Locale.ROOT);
            if (!code.matches("[A-Z]{3}")) {
                throw ApiException.badRequest("INVALID_CURRENCY", "currency must be a 3-letter code");
            }
            return code;
        }
        return available.isEmpty() ? null : available.get(0);
    }

    private Granularity chooseGranularity(String period, LocalDate start, LocalDate end) {
        return switch (period) {
            case "weekly" -> Granularity.WEEK;
            case "monthly" -> Granularity.MONTH;
            case "custom" -> {
                long days = ChronoUnit.DAYS.between(start, end);
                if (days <= 31) yield Granularity.DAY;
                if (days <= 180) yield Granularity.WEEK;
                yield Granularity.MONTH;
            }
            default -> Granularity.DAY;
        };
    }

    private LocalDate bucketStart(LocalDate date, Granularity granularity) {
        return switch (granularity) {
            case DAY -> date;
            case WEEK -> date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case MONTH -> date.with(TemporalAdjusters.firstDayOfMonth());
        };
    }

    private LocalDate bucketEnd(LocalDate bucketStart, Granularity granularity) {
        return switch (granularity) {
            case DAY -> bucketStart.plusDays(1);
            case WEEK -> bucketStart.plusWeeks(1);
            case MONTH -> bucketStart.plusMonths(1);
        };
    }

    private String labelFor(LocalDate bucketStart, Granularity granularity, LocalDate bucketEnd) {
        return switch (granularity) {
            case DAY -> bucketStart.toString();
            case WEEK -> bucketStart + " → " + bucketEnd.minusDays(1);
            case MONTH -> bucketStart.toString().substring(0, 7);
        };
    }

    private LocalDate parseDate(String value, String field) {
        if (value == null || value.isBlank()) {
            throw ApiException.badRequest("MISSING_DATE",
                    "'" + field + "' is required when period=custom");
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException ex) {
            throw ApiException.badRequest("INVALID_DATE",
                    "'" + field + "' must be an ISO date (yyyy-MM-dd)");
        }
    }

    // ------------------------------------------------------------------ transactions

    @Transactional(readOnly = true)
    public PageResult<Map<String, Object>> getTransactions(
            Integer page,
            Integer size,
            String status,
            String dateFrom,
            String dateTo,
            String gateway,
            String search,
            String sort,
            String direction) {

        Specification<Payment> spec = buildSpecification(status, dateFrom, dateTo, gateway, search);
        Pageable pageable = PageRequest.of(
                Math.max(page == null ? 0 : page, 0),
                Math.min(Math.max(size == null ? 20 : size, 1), MAX_PAGE_SIZE),
                buildSort(sort, direction));

        Page<Payment> result = repository.findAll(spec, pageable);
        Map<UUID, User> customers = loadCustomers(result.getContent());
        return PageResult.of(result, payment -> toRow(payment, customers.get(payment.getUserId())));
    }

    /** All matching rows in stable order, used by the CSV export. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> exportTransactions(
            String status, String dateFrom, String dateTo, String gateway, String search) {
        Specification<Payment> spec = buildSpecification(status, dateFrom, dateTo, gateway, search);
        List<Payment> rows = repository.findAll(spec, Sort.by(Sort.Direction.DESC, "createdAt"));
        Map<UUID, User> customers = loadCustomers(rows);
        return rows.stream().map(payment -> toRow(payment, customers.get(payment.getUserId()))).toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getTransactionDetails(UUID id) {
        Payment payment = repository.findById(id)
                .orElseThrow(() -> ApiException.notFound("PAYMENT_NOT_FOUND", "Payment not found"));
        User customer = userRepository.findById(payment.getUserId()).orElse(null);

        Map<String, Object> detail = new LinkedHashMap<>(toRow(payment, customer));
        detail.put("purpose", payment.getPurpose().apiValue());
        detail.put("recordedBy", payment.getRecordedBy());

        Map<String, Object> gatewayResponse = new LinkedHashMap<>();
        gatewayResponse.put("status", payment.getStatus().apiValue());
        gatewayResponse.put("reference", payment.getProviderRef());
        gatewayResponse.put("failureReason", payment.getFailureReason());
        detail.put("gatewayResponse", gatewayResponse);

        if (payment.getStatus() == PaymentStatus.REFUNDED) {
            Map<String, Object> refund = new LinkedHashMap<>();
            refund.put("refundedAt", payment.getRefundedAt());
            refund.put("reason", payment.getRefundReason());
            refund.put("amount", payment.getAmount());
            refund.put("currency", payment.getCurrency());
            refund.put("type", "full");
            detail.put("refund", refund);
        } else {
            detail.put("refund", null);
        }
        return detail;
    }

    private Specification<Payment> buildSpecification(
            String status, String dateFrom, String dateTo, String gateway, String search) {

        PaymentStatus parsedStatus = status == null || status.isBlank() ? null : parseStatus(status);
        Instant from = dateFrom == null || dateFrom.isBlank() ? null : parseInstant(dateFrom, "dateFrom", false);
        Instant to = dateTo == null || dateTo.isBlank() ? null : parseInstant(dateTo, "dateTo", true);
        String gatewayFilter = gateway == null || gateway.isBlank() ? null : gateway.trim().toUpperCase(Locale.ROOT);
        String term = search == null || search.isBlank() ? null : search.trim().toLowerCase(Locale.ROOT);

        return (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            if (parsedStatus != null) {
                predicates.add(cb.equal(root.get("status"), parsedStatus));
            }
            if (from != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from));
            }
            if (to != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), to));
            }
            if (gatewayFilter != null) {
                predicates.add(cb.equal(cb.upper(root.get("provider")), gatewayFilter));
            }
            if (term != null) {
                String like = "%" + term + "%";
                List<jakarta.persistence.criteria.Predicate> searches = new ArrayList<>();
                UUID termId = asUuid(term);
                if (termId != null) {
                    searches.add(cb.equal(root.get("id"), termId));
                    searches.add(cb.equal(root.get("referenceId"), termId));
                    searches.add(cb.equal(root.get("userId"), termId));
                }
                searches.add(cb.like(cb.lower(root.get("providerRef")), like));
                predicates.add(cb.or(searches.toArray(jakarta.persistence.criteria.Predicate[]::new)));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }

    private PaymentStatus parseStatus(String value) {
        try {
            return PaymentStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw ApiException.badRequest("INVALID_STATUS",
                    "status must be PENDING, PAID, FAILED or REFUNDED");
        }
    }

    /** IDs are UUID columns, so only exact matches are possible; other terms search text columns. */
    private UUID asUuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private Instant parseInstant(String value, String field, boolean endOfDay) {
        String trimmed = value.trim();
        try {
            // Accept a full ISO-8601 instant first, then a plain date (midnight UTC).
            return OffsetDateTime.parse(trimmed).toInstant();
        } catch (DateTimeParseException ignored) {
            // fall through to date parsing
        }
        try {
            LocalDate date = LocalDate.parse(trimmed);
            return (endOfDay ? date.plusDays(1).atStartOfDay(DEFAULT_ZONE) : date.atStartOfDay(DEFAULT_ZONE))
                    .toInstant();
        } catch (DateTimeParseException ex) {
            throw ApiException.badRequest("INVALID_DATE",
                    "'" + field + "' must be an ISO date (yyyy-MM-dd) or ISO timestamp");
        }
    }

    private Sort buildSort(String sort, String direction) {
        String field = switch (sort == null ? "createdAt" : sort.trim()) {
            case "amount" -> "amount";
            case "status" -> "status";
            case "paidAt" -> "paidAt";
            case "createdAt" -> "createdAt";
            default -> throw ApiException.badRequest("INVALID_SORT",
                    "sort must be createdAt, paidAt, amount or status");
        };
        Sort.Direction dir = "asc".equalsIgnoreCase(direction) ? Sort.Direction.ASC : Sort.Direction.DESC;
        return Sort.by(dir, field);
    }

    private Map<UUID, User> loadCustomers(Collection<Payment> payments) {
        Set<UUID> ids = payments.stream().map(Payment::getUserId).filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        return userRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
    }

    private Map<String, Object> toRow(Payment payment, User customer) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", payment.getId());
        row.put("orderId", payment.getReferenceId());
        row.put("referenceId", payment.getReferenceId());
        row.put("userId", payment.getUserId());
        row.put("customerName", customer == null ? null : customer.getFullName());
        row.put("customerEmail", customer == null ? null : customer.getEmail());
        row.put("amount", payment.getAmount());
        row.put("currency", payment.getCurrency());
        row.put("provider", payment.getProvider());
        row.put("gateway", payment.getProvider());
        row.put("providerRef", payment.getProviderRef());
        row.put("status", payment.getStatus().apiValue());
        row.put("createdAt", payment.getCreatedAt());
        row.put("paidAt", payment.getPaidAt());
        row.put("refundedAt", payment.getRefundedAt());
        row.put("refundReason", payment.getRefundReason());
        row.put("failureReason", payment.getFailureReason());
        return row;
    }

    /** Records a report export so sensitive admin actions stay auditable. */
    @Transactional
    public void auditExport(UUID actor, String status, String dateFrom, String dateTo,
                            String gateway, String search, int rowCount) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("status", status);
        details.put("dateFrom", dateFrom);
        details.put("dateTo", dateTo);
        details.put("gateway", gateway);
        details.put("search", search);
        details.put("rows", rowCount);
        auditService.record(actor, "PAYMENT_REPORT_EXPORTED", "payment", null, null, details);
    }

    private enum Granularity { DAY, WEEK, MONTH }

    // ------------------------------------------------------------------ DTOs

    public static class DashboardMetrics {
        private Map<String, Map<String, BigDecimal>> revenueByCurrency = Map.of();
        private List<String> currencies = List.of();
        private long totalTransactions;
        private long successfulPayments;
        private long failedPayments;
        private long pendingPayments;
        private long refundedPayments;
        private double successRate;

        public Map<String, Map<String, BigDecimal>> getRevenueByCurrency() { return revenueByCurrency; }
        public void setRevenueByCurrency(Map<String, Map<String, BigDecimal>> revenueByCurrency) {
            this.revenueByCurrency = revenueByCurrency;
        }
        public List<String> getCurrencies() { return currencies; }
        public void setCurrencies(List<String> currencies) { this.currencies = currencies; }
        public long getTotalTransactions() { return totalTransactions; }
        public void setTotalTransactions(long totalTransactions) { this.totalTransactions = totalTransactions; }
        public long getSuccessfulPayments() { return successfulPayments; }
        public void setSuccessfulPayments(long successfulPayments) { this.successfulPayments = successfulPayments; }
        public long getFailedPayments() { return failedPayments; }
        public void setFailedPayments(long failedPayments) { this.failedPayments = failedPayments; }
        public long getPendingPayments() { return pendingPayments; }
        public void setPendingPayments(long pendingPayments) { this.pendingPayments = pendingPayments; }
        public long getRefundedPayments() { return refundedPayments; }
        public void setRefundedPayments(long refundedPayments) { this.refundedPayments = refundedPayments; }
        public double getSuccessRate() { return successRate; }
        public void setSuccessRate(double successRate) { this.successRate = successRate; }
    }

    public static class RevenuePoint {
        private String label;
        private String bucketStart;
        private BigDecimal amount;

        public RevenuePoint() {
        }

        public RevenuePoint(String label, String bucketStart, BigDecimal amount) {
            this.label = label;
            this.bucketStart = bucketStart;
            this.amount = amount;
        }

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        public String getBucketStart() { return bucketStart; }
        public void setBucketStart(String bucketStart) { this.bucketStart = bucketStart; }
        public BigDecimal getAmount() { return amount; }
        public void setAmount(BigDecimal amount) { this.amount = amount; }
    }

    public static class RevenueAnalytics {
        private String period;
        private String granularity;
        private String start;
        private String end;
        private String currency;
        private List<String> currencies = List.of();
        private BigDecimal totalRevenue = BigDecimal.ZERO;
        private List<RevenuePoint> points = List.of();

        public String getPeriod() { return period; }
        public void setPeriod(String period) { this.period = period; }
        public String getGranularity() { return granularity; }
        public void setGranularity(String granularity) { this.granularity = granularity; }
        public String getStart() { return start; }
        public void setStart(String start) { this.start = start; }
        public String getEnd() { return end; }
        public void setEnd(String end) { this.end = end; }
        public String getCurrency() { return currency; }
        public void setCurrency(String currency) { this.currency = currency; }
        public List<String> getCurrencies() { return currencies; }
        public void setCurrencies(List<String> currencies) { this.currencies = currencies; }
        public BigDecimal getTotalRevenue() { return totalRevenue; }
        public void setTotalRevenue(BigDecimal totalRevenue) { this.totalRevenue = totalRevenue; }
        public List<RevenuePoint> getPoints() { return points; }
        public void setPoints(List<RevenuePoint> points) { this.points = points; }
    }
}
