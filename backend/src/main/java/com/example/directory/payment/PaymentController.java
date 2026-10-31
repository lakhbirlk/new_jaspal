package com.example.directory.payment;

import com.example.directory.auth.AuthPrincipal;
import com.example.directory.common.ApiException;
import com.example.directory.config.AppProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;
    private final PaymentRepository paymentRepository;
    private final AppProperties properties;

    @GetMapping("/my/payments")
    @PreAuthorize("hasAuthority('payment:read')")
    public List<Map<String, Object>> myPayments(@AuthenticationPrincipal AuthPrincipal principal) {
        return paymentService.myPayments(principal.id());
    }

    /**
     * Sandbox checkout used while no real gateway is connected. It settles the caller's own
     * pending subscription payment so the research flow can be exercised end to end. Disable
     * with {@code app.payments.demo-gateway-enabled=false} once a gateway is wired up.
     */
    @PostMapping("/payments/{id}/pay")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> pay(@PathVariable UUID id,
                                   @AuthenticationPrincipal AuthPrincipal principal) {
        if (!properties.getPayments().isDemoGatewayEnabled()) {
            throw ApiException.forbidden("PAYMENT_GATEWAY_UNAVAILABLE",
                    "Online payments are not available right now");
        }
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("PAYMENT_NOT_FOUND", "Payment not found"));
        if (!payment.getUserId().equals(principal.id())) {
            throw ApiException.notFound("PAYMENT_NOT_FOUND", "Payment not found");
        }
        if (payment.getPurpose() != PaymentPurpose.RESEARCHER_PLAN) {
            throw ApiException.badRequest("PAYMENT_NOT_PAYABLE",
                    "This payment has to be completed offline");
        }
        return paymentService.markPaid(payment, principal.id(), "DEMO-" + payment.getId());
    }
}
