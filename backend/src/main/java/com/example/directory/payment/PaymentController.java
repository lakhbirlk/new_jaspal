package com.example.directory.payment;

import com.example.directory.auth.AuthPrincipal;
import com.example.directory.common.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    @GetMapping("/my/payments")
    @PreAuthorize("hasAuthority('payment:read')")
    public List<Map<String, Object>> myPayments(@AuthenticationPrincipal AuthPrincipal principal) {
        return paymentService.myPayments(principal.id());
    }
}
