package com.example.directory;

import com.example.directory.auth.AuthPrincipal;
import com.example.directory.business.AdminListingStatus;
import com.example.directory.business.Business;
import com.example.directory.business.BusinessRepository;
import com.example.directory.business.Liability;
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
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class BootstrapData implements ApplicationRunner {

    private static final String DEMO_PASSWORD = "Demo@12345";

    private record DemoBusiness(String legalName, String tradeName, String industry, String category,
                                String city, String state, String addressLine, String postalCode,
                                String description) {
    }

    private static final List<DemoBusiness> DEMO_BUSINESSES = List.of(
            new DemoBusiness("Sahyadri Analytical Instruments Private Limited", "Sahyadri Instruments",
                    "Scientific equipment", "Analytical instruments", "Pune", "Maharashtra",
                    "41 MIDC Bhosari", "411026",
                    "Laboratory-grade spectrometers, chromatographs and calibration services for research labs."),
            new DemoBusiness("Meridian Pharma Labs Limited", "Meridian Labs",
                    "Pharmaceuticals", "Contract research", "Hyderabad", "Telangana",
                    "Plot 18 Genome Valley", "500078",
                    "Contract testing and formulation development for small-molecule drugs."),
            new DemoBusiness("Bluewave IT Solutions Private Limited", "Bluewave IT",
                    "Information technology", "Software services", "Bengaluru", "Karnataka",
                    "7th Floor, Prestige Tech Park, Kadubeesanahalli", "560103",
                    "Custom software, data engineering and cloud migration services."),
            new DemoBusiness("NorthStar Logistics India Private Limited", "NorthStar Logistics",
                    "Logistics", "Freight forwarding", "Chennai", "Tamil Nadu",
                    "22 Port Trust Road, Royapuram", "600013",
                    "Pan-India container freight and cold-chain distribution."),
            new DemoBusiness("Green Harvest AgriTech Private Limited", "Green Harvest",
                    "Agriculture", "Agri inputs", "Nashik", "Maharashtra",
                    "Gat No. 45, Dindori Road", "422004",
                    "Drip irrigation systems, soil testing kits and farm advisory services."),
            new DemoBusiness("Loomcraft Textiles Private Limited", "Loomcraft",
                    "Textiles", "Home furnishings", "Surat", "Gujarat",
                    "108 Ring Road, Udhna", "394210",
                    "Woven home textiles exported to Europe and the Gulf."),
            new DemoBusiness("TorqueLine Auto Components Limited", "TorqueLine",
                    "Automotive", "Precision parts", "Coimbatore", "Tamil Nadu",
                    "9 SIDCO Industrial Estate", "641021",
                    "Machined engine and transmission components for OEMs."),
            new DemoBusiness("Vindhya Chemicals Private Limited", "Vindhya Chemicals",
                    "Chemicals", "Specialty chemicals", "Vadodara", "Gujarat",
                    "Plot 212 GIDC Makarpura", "390010",
                    "Specialty solvents and intermediates for coatings manufacturers."),
            new DemoBusiness("CarePoint Medical Devices Private Limited", "CarePoint",
                    "Healthcare", "Medical devices", "Delhi", "Delhi",
                    "B-14 Okhla Industrial Area Phase II", "110020",
                    "Patient monitors, infusion pumps and hospital-grade consumables."),
            new DemoBusiness("SunGrid Renewables Limited", "SunGrid",
                    "Renewable energy", "Solar EPC", "Jaipur", "Rajasthan",
                    "SP-6 Sitapura Industrial Area", "302022",
                    "Turnkey rooftop and utility-scale solar installations."),
            new DemoBusiness("Annapurna Food Processing Private Limited", "Annapurna Foods",
                    "Food processing", "Packaged foods", "Indore", "Madhya Pradesh",
                    "31 Pologround Industrial Area", "452015",
                    "Ready-to-cook staples and dehydrated vegetable processing."),
            new DemoBusiness("SolidBuild Construction Materials Private Limited", "SolidBuild",
                    "Construction", "Building materials", "Ahmedabad", "Gujarat",
                    "Survey 210, Sarkhej-Bavla Highway", "382210",
                    "Cement blocks, precast panels and waterproofing systems."),
            new DemoBusiness("CircuitWorks Electronics Private Limited", "CircuitWorks",
                    "Electronics", "PCB assembly", "Kochi", "Kerala",
                    "17 KINFRA Park, Kalamassery", "683104",
                    "PCB design, SMT assembly and electronics testing."),
            new DemoBusiness("PackRight Solutions Private Limited", "PackRight",
                    "Packaging", "Flexible packaging", "Nagpur", "Maharashtra",
                    "5 Butibori MIDC", "441122",
                    "Flexible laminates and sustainable packaging for FMCG brands."),
            new DemoBusiness("InsightEdge Consulting Private Limited", "InsightEdge",
                    "Consulting", "Market research", "Mumbai", "Maharashtra",
                    "302 Nariman Point", "400021",
                    "Market entry studies and supply-chain benchmarking."),
            new DemoBusiness("Vidya Learning Systems Private Limited", "Vidya Learning",
                    "Education", "EdTech", "Lucknow", "Uttar Pradesh",
                    "44 Gomti Nagar Extension", "226010",
                    "Blended learning platforms and vocational training content."),
            new DemoBusiness("Oakwood Interiors Private Limited", "Oakwood Interiors",
                    "Furniture", "Contract furniture", "Chandigarh", "Chandigarh",
                    "12 Industrial Area Phase I", "160002",
                    "Ergonomic office and institutional furniture manufacturing."),
            new DemoBusiness("Ironclad Fabrication Works Private Limited", "Ironclad Fabrication",
                    "Metal fabrication", "Heavy fabrication", "Ludhiana", "Punjab",
                    "88 Focal Point", "141010",
                    "Structural steel fabrication and precision welding."),
            new DemoBusiness("PolyMold Plastics Private Limited", "PolyMold",
                    "Plastics", "Injection moulding", "Bhopal", "Madhya Pradesh",
                    "6 Govindpura Industrial Area", "462023",
                    "Injection-moulded components and tooling for appliances."),
            new DemoBusiness("Helix Biotech Research Private Limited", "Helix Biotech",
                    "Biotechnology", "Life sciences", "Visakhapatnam", "Andhra Pradesh",
                    "3 AP MedTech Zone", "530046",
                    "Assay development and pre-clinical research support.")
    );

    /** Default corporate profile video used by the demo businesses. */
    private static final String DEMO_PROFILE_VIDEO =
            "https://www.youtube.com/watch?v=fQ9nQNx0KEs&list=RDfQ9nQNx0KEs&start_radio=1";

    private static final List<String> DEMO_CA_NAMES = List.of(
            "CA Rajesh Mehta", "CA Sunita Sharma", "CA Dhruv Patel", "CA Priya Tiwari",
            "CA Neha Joshi", "CA Arvind Rao", "CA Meera Iyer", "CA Vikram Singh");

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
            seedFinancials(business, 12_500_000L, 3);
            business.setDescription("A demo business supplying laboratory equipment and consumables "
                    + "to research institutions across India.");
            business.setProfileVideoUrl(DEMO_PROFILE_VIDEO);
            business.setLiabilities(List.of(new Liability("Bank Term Loan", "State Bank of India",
                    new BigDecimal("3500000"))));
            business.setCaName("CA Rajesh Mehta");
            business.setCaMembershipNo("123456");
            business.setCaUdin("26123456ABCDE12345");
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

        int seeded = seedDemoBusinesses();
        log.info("Seeded {} demo businesses for the public listing", seeded);
        log.info("Backfilled published financials for {} demo businesses", backfillFinancials());
        log.info("Demo accounts use password {}", DEMO_PASSWORD);
    }

    /**
     * Creates a listed, verified business plus an active owner account for each entry in
     * {@link #DEMO_BUSINESSES}. Idempotent: entries whose owner already exists are skipped.
     */
    private int seedDemoBusinesses() {
        int seeded = 0;
        for (int index = 1; index <= DEMO_BUSINESSES.size(); index++) {
            DemoBusiness demo = DEMO_BUSINESSES.get(index - 1);
            User owner = seedUser("business" + index + "@directory.local",
                    demo.tradeName() + " Owner", Role.BUSINESS);
            if (owner == null) {
                continue;
            }
            String phone = String.format("+91 90000 %05d", 10000 + index);
            Business business = new Business();
            business.setOwnerUserId(owner.getId());
            business.setLegalName(demo.legalName());
            business.setTradeName(demo.tradeName());
            business.setRegistrationNumber(String.format("U74999MH%04dPTC%05d", 2014 + index % 10, index));
            business.setTaxId(cryptoService.encrypt(String.format("27AAACA%04dA1Z5", 1000 + index)));
            business.setIndustry(demo.industry());
            business.setCategory(demo.category());
            business.setAddressLine(demo.addressLine());
            business.setCity(demo.city());
            business.setState(demo.state());
            business.setCountry("India");
            business.setPostalCode(demo.postalCode());
            business.setWebsite("https://business" + index + ".example.com");
            business.setPublicEmail("contact" + index + "@example.com");
            business.setPublicPhone(phone);
            business.setContactPersonName(owner.getFullName());
            business.setContactPersonPhone(phone);
            business.setAnnualRevenue(BigDecimal.valueOf(4_500_000L + (long) index * 1_750_000L));
            business.setEmployeeCount(8 + index * 6);
            seedFinancials(business, 4_500_000L + (long) index * 1_750_000L, index);
            business.setDescription(demo.description());
            // Leave every third demo company without a video so both states are visible.
            if (index % 3 != 0) {
                business.setProfileVideoUrl(DEMO_PROFILE_VIDEO);
            }
            business.setLiabilities(seedLiabilities(index,
                    4_500_000L + (long) index * 1_750_000L));
            business.setCaName(DEMO_CA_NAMES.get((index - 1) % DEMO_CA_NAMES.size()));
            business.setCaMembershipNo(String.format("%06d", 120_000 + index * 37));
            business.setCaUdin(String.format("26%06dABCDE%05d", 100_000 + index, index));
            business.setVerificationStatus(VerificationStatus.VERIFIED);
            business.setAdminListingStatus(AdminListingStatus.LISTED);
            business.setListedUntil(Instant.now().plus(365, ChronoUnit.DAYS));
            businessRepository.save(business);
            seeded++;
        }
        return seeded;
    }

    /**
     * Demo-only liabilities derived from annual revenue. Every fifth company is debt-free so the
     * "no outstanding loans" state is visible in the researcher company profile.
     */
    private List<Liability> seedLiabilities(int index, long annualRevenue) {
        if (index % 5 == 0) {
            return List.of();
        }
        String[] lenders = {"State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank",
                "Bajaj Finance", "Cholamandalam"};
        List<Liability> liabilities = new ArrayList<>();
        liabilities.add(new Liability("Bank Term Loan", lenders[index % lenders.length],
                BigDecimal.valueOf(Math.round(annualRevenue * 0.28))));
        if (index % 2 == 0) {
            liabilities.add(new Liability("Cash Credit / OD",
                    lenders[(index + 1) % lenders.length],
                    BigDecimal.valueOf(Math.round(annualRevenue * 0.12))));
        }
        return liabilities;
    }

    /**
     * Demo-only published financials: a deterministic 36-month turnover series, net profit and
     * net worth derived from annual revenue, so the company database renders complete cards.
     */
    private void seedFinancials(Business business, long annualRevenue, int seed) {
        business.setNetProfit(BigDecimal.valueOf(Math.round(annualRevenue * (0.07 + (seed % 5) * 0.015))));
        business.setNetWorth(BigDecimal.valueOf(Math.round(annualRevenue * (1.2 + (seed % 7) * 0.22))));
        List<Long> series = new ArrayList<>(36);
        double value = annualRevenue / 12.0 * 0.76;
        for (int month = 0; month < 36; month++) {
            double seasonal = 1 + 0.06 * Math.sin((month + seed) / 3.0);
            double noise = 1 + (((seed * 37 + month * 17) % 11) - 5) / 100.0;
            series.add(Math.max(25_000L, Math.round(value * seasonal * noise)));
            value *= 1.008;
        }
        business.setMonthlyTurnover(series);
    }

    /** Gives already-seeded demo listings financials added after the first seed run. */
    private int backfillFinancials() {
        int updated = 0;
        for (Business business : businessRepository.findCurrentlyListed(Instant.now())) {
            if (business.getMonthlyTurnover() != null && !business.getMonthlyTurnover().isEmpty()) {
                continue;
            }
            long revenue = business.getAnnualRevenue() == null
                    ? 6_000_000L : business.getAnnualRevenue().longValue();
            seedFinancials(business, revenue, Math.abs(business.getId().hashCode()) % 97 + 1);
            businessRepository.save(business);
            updated++;
        }
        return updated;
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
