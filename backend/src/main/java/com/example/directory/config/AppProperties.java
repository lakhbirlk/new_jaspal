package com.example.directory.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Arrays;
import java.util.List;

@Data
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private Jwt jwt = new Jwt();
    private Crypto crypto = new Crypto();
    private Admin admin = new Admin();
    private Mail mail = new Mail();
    private Dev dev = new Dev();
    private RateLimit rateLimit = new RateLimit();
    private Cors cors = new Cors();
    private Payments payments = new Payments();
    private Listing listing = new Listing();
    private String frontendUrl = "http://localhost:8081";

    @Data
    public static class Jwt {
        private String secret;
        private int accessTokenMinutes = 15;
        private int refreshTokenDays = 7;
    }

    @Data
    public static class Crypto {
        private String key;
    }

    @Data
    public static class Admin {
        private String email;
        private String password;
        private String fullName = "Platform Administrator";
    }

    @Data
    public static class Mail {
        private String from = "no-reply@directory.local";
    }

    @Data
    public static class Dev {
        private boolean exposeEmailTokens = false;
        private boolean seedDemo = false;
    }

    @Data
    public static class RateLimit {
        private int loginPerMinute = 10;
        private int registerPerMinute = 5;
        private int searchPerMinute = 60;
    }

    @Data
    public static class Cors {
        private List<String> allowedOrigins = Arrays.asList(
                "http://localhost:8081", "http://localhost:19006", "http://localhost:5173");
    }

    @Data
    public static class Payments {
        private String webhookSecret;
        /** Enables the built-in sandbox gateway so users can complete a checkout locally. */
        private boolean demoGatewayEnabled = true;
    }

    @Data
    public static class Listing {
        private int reminderDays = 7;
    }
}
