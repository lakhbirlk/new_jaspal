package com.example.directory.payment;

import com.example.directory.common.ApiException;
import com.example.directory.config.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/payments/webhook")
@RequiredArgsConstructor
public class PaymentWebhookController {

    private final PaymentService paymentService;
    private final PaymentRepository paymentRepository;
    private final AppProperties properties;
    private final ObjectMapper objectMapper;

    @PostMapping("/{provider}")
    public Map<String, Object> handle(@PathVariable String provider,
                                      @RequestHeader(value = "X-Signature", required = false) String signature,
                                      @RequestBody String body) {
        String secret = properties.getPayments().getWebhookSecret();
        if (secret == null || secret.isBlank()) {
            throw ApiException.forbidden("WEBHOOK_DISABLED",
                    "No payment webhook secret is configured");
        }
        if (signature == null || !constantTimeEquals(expectedSignature(secret, body),
                signature.replaceFirst("^sha256=", ""))) {
            throw ApiException.forbidden("INVALID_SIGNATURE", "Invalid webhook signature");
        }

        JsonNode payload;
        try {
            payload = objectMapper.readTree(body);
        } catch (Exception ex) {
            throw ApiException.badRequest("INVALID_PAYLOAD", "The webhook body is not valid JSON");
        }
        String event = text(payload, "status");
        String providerRef = text(payload, "providerRef");
        UUID paymentId = uuid(text(payload, "paymentId"));
        if (paymentId == null) {
            throw ApiException.badRequest("PAYMENT_ID_REQUIRED", "paymentId is required");
        }

        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> ApiException.notFound("PAYMENT_NOT_FOUND", "Payment not found"));
        if (!"MANUAL".equalsIgnoreCase(payment.getProvider())
                && !payment.getProvider().equalsIgnoreCase(provider)) {
            throw ApiException.badRequest("PROVIDER_MISMATCH",
                    "The payment was not created for this provider");
        }

        String status = event == null ? "" : event.trim().toUpperCase(Locale.ROOT);
        return switch (status) {
            case "PAID", "SUCCESS", "CAPTURED" ->
                    paymentService.markPaid(payment, null, providerRef);
            case "FAILED", "CANCELLED" -> paymentService.markFailed(payment.getId(), providerRef);
            default -> throw ApiException.badRequest("INVALID_EVENT",
                    "Unsupported webhook status: " + event);
        };
    }

    private String expectedSignature(String secret, String body) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(body.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception ex) {
            throw ApiException.forbidden("WEBHOOK_ERROR", "Could not verify the webhook signature");
        }
    }

    private boolean constantTimeEquals(String expected, String actual) {
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),
                actual.getBytes(StandardCharsets.UTF_8));
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private UUID uuid(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return UUID.fromString(value);
        } catch (Exception ex) {
            throw ApiException.badRequest("INVALID_ID", "Invalid paymentId");
        }
    }
}
