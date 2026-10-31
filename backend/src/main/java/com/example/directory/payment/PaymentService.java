package com.example.directory.payment;

import com.example.directory.audit.AuditService;
import com.example.directory.common.ApiException;
import com.example.directory.common.PageResult;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository repository;
    private final AuditService auditService;
    private final List<PaymentCompletionHandler> completionHandlers;

    @Transactional
    public Payment createPending(UUID userId, PaymentPurpose purpose, UUID referenceId,
                                 BigDecimal amount, String currency, String provider) {
        Payment payment = new Payment();
        payment.setUserId(userId);
        payment.setPurpose(purpose);
        payment.setReferenceId(referenceId);
        payment.setAmount(amount);
        payment.setCurrency(currency);
        payment.setProvider(provider == null || provider.isBlank() ? "MANUAL" : provider);
        payment.setStatus(PaymentStatus.PENDING);
        return repository.save(payment);
    }

    @Transactional
    public Map<String, Object> markPaid(UUID paymentId, UUID actor, String providerRef) {
        Payment payment = repository.findById(paymentId)
                .orElseThrow(() -> ApiException.notFound("PAYMENT_NOT_FOUND", "Payment not found"));
        return markPaid(payment, actor, providerRef);
    }

    @Transactional
    public Map<String, Object> markPaid(Payment payment, UUID actor, String providerRef) {
        if (payment.getStatus() == PaymentStatus.PAID) {
            return toMap(payment);
        }
        if (payment.getStatus() != PaymentStatus.PENDING) {
            throw ApiException.conflict("PAYMENT_NOT_PENDING",
                    "Only a pending payment can be marked paid");
        }
        if (providerRef != null && !providerRef.isBlank()) {
            Optional<Payment> duplicate = repository.findByProviderRef(providerRef);
            if (duplicate.isPresent() && !duplicate.get().getId().equals(payment.getId())) {
                return toMap(duplicate.get());
            }
            payment.setProviderRef(providerRef);
        }
        payment.setStatus(PaymentStatus.PAID);
        payment.setPaidAt(Instant.now());
        if (actor != null) {
            payment.setRecordedBy(actor);
        }

        PaymentCompletionHandler handler = completionHandlers.stream()
                .filter(candidate -> candidate.purpose() == payment.getPurpose())
                .findFirst()
                .orElseThrow(() -> ApiException.conflict("PAYMENT_PURPOSE_UNSUPPORTED",
                        "This payment cannot be completed automatically"));
        handler.onPaid(payment);
        Payment saved = repository.save(payment);
        auditService.record(actor, "PAYMENT_PAID", "payment", saved.getId(), null, toMap(saved));
        return toMap(saved);
    }

    @Transactional
    public Map<String, Object> markFailed(UUID paymentId, String providerRef) {
        return markFailed(paymentId, providerRef, null);
    }

    @Transactional
    public Map<String, Object> markFailed(UUID paymentId, String providerRef, String reason) {
        Payment payment = repository.findById(paymentId)
                .orElseThrow(() -> ApiException.notFound("PAYMENT_NOT_FOUND", "Payment not found"));
        if (payment.getStatus() == PaymentStatus.PAID) {
            return toMap(payment);
        }
        if (payment.getStatus() != PaymentStatus.PENDING) {
            return toMap(payment);
        }
        payment.setStatus(PaymentStatus.FAILED);
        if (providerRef != null && !providerRef.isBlank()) {
            payment.setProviderRef(providerRef);
        }
        if (reason != null && !reason.isBlank()) {
            payment.setFailureReason(reason.trim());
        }
        Payment saved = repository.save(payment);
        auditService.record(null, "PAYMENT_FAILED", "payment", saved.getId(), null, toMap(saved));
        return toMap(saved);
    }

    @Transactional
    public Map<String, Object> refund(UUID paymentId, UUID actor, String reason) {
        Payment payment = repository.findById(paymentId)
                .orElseThrow(() -> ApiException.notFound("PAYMENT_NOT_FOUND", "Payment not found"));
        if (payment.getStatus() != PaymentStatus.PAID) {
            throw ApiException.conflict("PAYMENT_NOT_PAID", "Only a paid payment can be refunded");
        }
        Map<String, Object> before = toMap(payment);
        payment.setStatus(PaymentStatus.REFUNDED);
        payment.setRefundedAt(Instant.now());
        if (reason != null && !reason.isBlank()) {
            payment.setRefundReason(reason.trim());
        }
        Payment saved = repository.save(payment);
        Map<String, Object> after = toMap(saved);
        auditService.record(actor, "PAYMENT_REFUNDED", "payment", paymentId, before, after);
        return after;
    }

    public List<Map<String, Object>> myPayments(UUID userId) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toMap).toList();
    }

    public PageResult<Map<String, Object>> adminList(String status, UUID userId, int page, int size) {
        Specification<Payment> specification = (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            if (status != null && !status.isBlank()) {
                PaymentStatus parsed;
                try {
                    parsed = PaymentStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
                } catch (Exception ex) {
                    throw ApiException.badRequest("INVALID_STATUS", "Unknown payment status");
                }
                predicates.add(cb.equal(root.get("status"), parsed));
            }
            if (userId != null) {
                predicates.add(cb.equal(root.get("userId"), userId));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        Page<Payment> result = repository.findAll(specification,
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                        Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResult.of(result, this::toMap);
    }

    public Map<String, Object> toMap(Payment payment) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", payment.getId());
        map.put("userId", payment.getUserId());
        map.put("purpose", payment.getPurpose().apiValue());
        map.put("referenceId", payment.getReferenceId());
        map.put("amount", payment.getAmount());
        map.put("currency", payment.getCurrency());
        map.put("provider", payment.getProvider());
        map.put("providerRef", payment.getProviderRef());
        map.put("status", payment.getStatus().apiValue());
        map.put("recordedBy", payment.getRecordedBy());
        map.put("createdAt", payment.getCreatedAt());
        map.put("paidAt", payment.getPaidAt());
        map.put("refundedAt", payment.getRefundedAt());
        map.put("refundReason", payment.getRefundReason());
        map.put("failureReason", payment.getFailureReason());
        return map;
    }
}
