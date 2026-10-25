package com.example.directory;

import com.example.directory.auth.AuthPrincipal;
import com.example.directory.business.AdminListingStatus;
import com.example.directory.business.Business;
import com.example.directory.business.BusinessRepository;
import com.example.directory.business.VerificationStatus;
import com.example.directory.common.CryptoService;
import com.example.directory.config.AppProperties;
import com.example.directory.subscription.SubscriptionService;
import com.example.directory.user.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class BootstrapData implements ApplicationRunner {

    private static final String DEMO_PASSWORD = "Demo@12345";

    private final UserRepository userRepository;
    private final ResearcherProfileRepository profileRepository;
    private final BusinessRepository businessRepository;
    private final PasswordEncoder passwordEncoder;
    private final CryptoService cryptoService;
    private final SubscriptionService subscriptionService;
    private final AppProperties properties;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        seedAdmin();
        if (properties.getDev().isSeedDemo()) {
            seedDemo();
        }
    }

    private void seedAdmin() {
        AppProperties.Admin admin = properties.getAdmin();
        if (userRepository.countByRole(Role.ADMIN) > 0) {
            return;
        }
        if (admin.getEmail() == null || admin.getEmail().isBlank()
                || admin.getPassword() == null || admin.getPassword().isBlank()) {
            log.warn("No admin account exists and ADMIN_EMAIL/ADMIN_PASSWORD are not configured");
            return;
        }
        User user = baseUser(admin.getEmail(), admin.getPassword(), Role.ADMIN,
                admin.getFullName() == null ? "Platform Administrator" : admin.getFullName());
        userRepository.save(user);
        log.info("Bootstrapped admin account {}", user.getEmail());
    }

    private void seedDemo() {
        User researcher = seedUser("researcher@directory.local", "Demo Researcher", Role.RESEARCHER);
        if (researcher != null) {
            ResearcherProfile profile = new ResearcherProfile();
            profile.setUserId(researcher.getId());
            profile.setFullName(researcher.getFullName());
            profile.setOrganization("Demo Research Institute");
            profile.setDesignation("Research Analyst");
            profile.setPhone("+91 90000 00001");
            profile.setPurposeOfResearch("Market and supplier research for the demo environment.");
            profileRepository.save(profile);
            subscriptionService.subscribe(new AuthPrincipal(researcher.getId(), Role.RESEARCHER,
                    UserStatus.ACTIVE, false), "BASIC");
            log.info("Seeded demo researcher {} with the BASIC plan", researcher.getEmail());
        }

        User businessOwner = seedUser("business@directory.local", "Demo Business Owner", Role.BUSINESS);
        if (businessOwner != null) {
            Business business = new Business();
            business.setOwnerUserId(businessOwner.getId());
            business.setLegalName("Acme Research Supplies Private Limited");
            business.setTradeName("Acme Supplies");
            business.setRegistrationNumber("U74999MH2020PTC000001");
            business.setTaxId(cryptoService.encrypt("27AAACA1234A1Z5"));
            business.setIndustry("Scientific equipment");
            business.setCategory("Lab supplies");
            business.setAddressLine("12 Sample Street, Andheri East");
            business.setCity("Mumbai");
            business.setState("Maharashtra");
            business.setCountry("India");
            business.setPostalCode("400069");
            business.setWebsite("https://acme.example.com");
            business.setPublicEmail("hello@acme.example.com");
            business.setPublicPhone("+91 90000 00002");
            business.setContactPersonName("Demo Business Owner");
            business.setContactPersonPhone("+91 90000 00002");
            business.setAnnualRevenue(new BigDecimal("12500000"));
            business.setEmployeeCount(45);
            business.setDescription("A demo business supplying laboratory equipment and consumables "
                    + "to research institutions across India.");
            business.setVerificationStatus(VerificationStatus.VERIFIED);
            business.setAdminListingStatus(AdminListingStatus.LISTED);
            business.setListedUntil(Instant.now().plus(730, ChronoUnit.DAYS));
            businessRepository.save(business);
            log.info("Seeded demo business {}", business.getLegalName());
        }

        User auditor = seedUser("auditor@directory.local", "Demo Auditor", Role.AUDITOR);
        if (auditor != null) {
            log.info("Seeded demo auditor {}", auditor.getEmail());
        }
        log.info("Demo accounts use password {}", DEMO_PASSWORD);
    }

    private User seedUser(String email, String fullName, Role role) {
        if (userRepository.existsByEmailIgnoreCase(email)) {
            return null;
        }
        User user = baseUser(email, DEMO_PASSWORD, role, fullName);
        return userRepository.save(user);
    }

    private User baseUser(String email, String rawPassword, Role role, String fullName) {
        User user = new User();
        user.setEmail(email.trim().toLowerCase(java.util.Locale.ROOT));
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setRole(role);
        user.setStatus(UserStatus.ACTIVE);
        user.setEmailVerifiedAt(Instant.now());
        user.setFullName(fullName);
        return user;
    }
}
