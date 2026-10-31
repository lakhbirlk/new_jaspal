-- Multi-role business directory platform - initial schema (MySQL 8).

CREATE TABLE users (
    id                 char(36) NOT NULL,
    email              varchar(320) NOT NULL,
    password_hash      varchar(255) NOT NULL,
    role               ENUM('ADMIN','AUDITOR','BUSINESS','RESEARCHER') NOT NULL,
    status             ENUM('ACTIVE','PENDING_EMAIL','PENDING_PROFILE','PENDING_REVIEW','REJECTED','SUSPENDED') NOT NULL,
    email_verified_at  datetime(6),
    mfa_secret         varchar(255),
    mfa_enabled        bit(1) NOT NULL DEFAULT b'0',
    failed_login_count int NOT NULL DEFAULT 0,
    locked_until       datetime(6),
    full_name          varchar(200) NOT NULL,
    submitted_at       datetime(6),
    review_note        text,
    token_version      int NOT NULL DEFAULT 0,
    created_at         datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at         datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY ux_users_email (email),
    KEY ix_users_role_status (role, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE researcher_profiles (
    user_id             char(36) NOT NULL,
    full_name           varchar(200),
    organization        varchar(200),
    designation         varchar(200),
    phone               varchar(40),
    purpose_of_research text,
    updated_at          datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (user_id),
    CONSTRAINT fk_researcher_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE businesses (
    id                    char(36) NOT NULL,
    owner_user_id         char(36),
    legal_name            varchar(300) NOT NULL,
    trade_name            varchar(300),
    registration_number   varchar(100),
    tax_id                varchar(255),
    industry              varchar(150),
    category              varchar(150),
    address_line          varchar(500),
    city                  varchar(150),
    state                 varchar(150),
    country               varchar(150),
    postal_code           varchar(30),
    website               varchar(300),
    public_email          varchar(320),
    public_phone          varchar(40),
    contact_person_name   varchar(200),
    contact_person_phone  varchar(40),
    annual_revenue        decimal(38,2),
    employee_count        int,
    bank_details          text,
    description           text,
    verification_status   ENUM('REJECTED','UNVERIFIED','VERIFIED') NOT NULL DEFAULT 'UNVERIFIED',
    listed_until          datetime(6),
    admin_listing_status  ENUM('LISTED','UNLISTED') NOT NULL DEFAULT 'UNLISTED',
    created_at            datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at            datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    -- MySQL unique indexes allow multiple NULLs, matching the previous partial unique index.
    UNIQUE KEY ux_businesses_owner (owner_user_id),
    KEY ix_businesses_industry_city (industry, city),
    KEY ix_businesses_listing (admin_listing_status, listed_until),
    CONSTRAINT fk_businesses_owner FOREIGN KEY (owner_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE documents (
    id                 char(36) NOT NULL,
    owner_user_id      char(36) NOT NULL,
    business_id        char(36),
    doc_type           ENUM('ADDRESS_PROOF','BUSINESS_LICENSE','ID_PROOF','OTHER','TAX_CERTIFICATE') NOT NULL,
    original_filename  varchar(255) NOT NULL,
    content            longblob NOT NULL,
    mime_type          varchar(120) NOT NULL,
    size_bytes         bigint NOT NULL,
    checksum           varchar(64) NOT NULL,
    status             ENUM('APPROVED','PENDING','REJECTED') NOT NULL DEFAULT 'PENDING',
    reviewed_by        char(36),
    reviewed_at        datetime(6),
    rejection_reason   text,
    created_at         datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_documents_owner (owner_user_id),
    KEY ix_documents_status (status),
    CONSTRAINT fk_documents_owner FOREIGN KEY (owner_user_id) REFERENCES users(id),
    CONSTRAINT fk_documents_business FOREIGN KEY (business_id) REFERENCES businesses(id),
    CONSTRAINT fk_documents_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE permissions (
    id   char(36) NOT NULL,
    code varchar(80) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY ux_permissions_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE role_permissions (
    id            char(36) NOT NULL,
    role          ENUM('ADMIN','AUDITOR','BUSINESS','RESEARCHER') NOT NULL,
    permission_id char(36) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY ux_role_permissions (role, permission_id),
    CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE field_policies (
    id           char(36) NOT NULL,
    role         ENUM('ADMIN','AUDITOR','BUSINESS','RESEARCHER') NOT NULL,
    resource     varchar(60) NOT NULL,
    field        varchar(80) NOT NULL,
    access       ENUM('HIDDEN','MASKED','READ','WRITE') NOT NULL,
    unlock_state ENUM('ANY','LOCKED','UNLOCKED') NOT NULL DEFAULT 'ANY',
    updated_by   char(36),
    updated_at   datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY ux_field_policies (role, resource, field, unlock_state),
    CONSTRAINT fk_field_policies_editor FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_policy_overrides (
    id           char(36) NOT NULL,
    user_id      char(36) NOT NULL,
    resource     varchar(60) NOT NULL,
    field        varchar(80) NOT NULL,
    access       ENUM('HIDDEN','MASKED','READ','WRITE') NOT NULL,
    unlock_state ENUM('ANY','LOCKED','UNLOCKED') NOT NULL DEFAULT 'ANY',
    expires_at   datetime(6),
    updated_by   char(36),
    updated_at   datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY ux_user_policy_overrides (user_id, resource, field, unlock_state),
    CONSTRAINT fk_user_policy_overrides_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_policy_overrides_editor FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE audit_logs (
    id            char(36) NOT NULL,
    actor_user_id char(36),
    action        varchar(100) NOT NULL,
    resource_type varchar(60) NOT NULL,
    resource_id   char(36),
    before_state  json,
    after_state   json,
    ip            varchar(64),
    user_agent    text,
    created_at    datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_audit_actor_time (actor_user_id, created_at),
    KEY ix_audit_resource (resource_type, resource_id),
    CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE refresh_tokens (
    id         char(36) NOT NULL,
    user_id    char(36) NOT NULL,
    token_hash varchar(64) NOT NULL,
    family_id  char(36) NOT NULL,
    expires_at datetime(6) NOT NULL,
    revoked_at datetime(6),
    ip         varchar(64),
    user_agent text,
    created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY ux_refresh_tokens_hash (token_hash),
    KEY ix_refresh_family (family_id),
    KEY ix_refresh_user (user_id),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE email_tokens (
    id         char(36) NOT NULL,
    user_id    char(36) NOT NULL,
    purpose    ENUM('INVITE','RESET','VERIFY') NOT NULL,
    token_hash varchar(64) NOT NULL,
    expires_at datetime(6) NOT NULL,
    used_at    datetime(6),
    created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY ux_email_tokens_hash (token_hash),
    CONSTRAINT fk_email_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE research_access_log (
    id                 char(36) NOT NULL,
    researcher_user_id char(36) NOT NULL,
    business_id        char(36),
    query              text,
    viewed_at          datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_research_access_researcher FOREIGN KEY (researcher_user_id) REFERENCES users(id),
    CONSTRAINT fk_research_access_business FOREIGN KEY (business_id) REFERENCES businesses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE plans (
    id              char(36) NOT NULL,
    code            varchar(40) NOT NULL,
    name            varchar(120) NOT NULL,
    audience        ENUM('BUSINESS','RESEARCHER') NOT NULL,
    credits         int,
    duration_months int NOT NULL,
    price_amount    decimal(38,2) NOT NULL DEFAULT 0,
    currency        varchar(10) NOT NULL DEFAULT 'INR',
    is_active       bit(1) NOT NULL DEFAULT b'1',
    created_at      datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY ux_plans_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE subscriptions (
    id                char(36) NOT NULL,
    user_id           char(36) NOT NULL,
    plan_id           char(36) NOT NULL,
    status            ENUM('ACTIVE','EXPIRED','CANCELLED') NOT NULL,
    starts_at         datetime(6) NOT NULL,
    ends_at           datetime(6) NOT NULL,
    credits_granted   int NOT NULL,
    credits_remaining int NOT NULL,
    cancelled_at      datetime(6),
    created_at        datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at        datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_subscriptions_ends (status, ends_at),
    CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE credit_ledger (
    id              char(36) NOT NULL,
    user_id         char(36) NOT NULL,
    subscription_id char(36),
    entry_type      ENUM('ADMIN_ADJUST','EXPIRE','GRANT','SPEND') NOT NULL,
    amount          int NOT NULL,
    business_id     char(36),
    balance_after   int NOT NULL,
    reason          text,
    created_by      char(36),
    created_at      datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_ledger_user_time (user_id, created_at),
    CONSTRAINT fk_credit_ledger_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_credit_ledger_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
    CONSTRAINT fk_credit_ledger_business FOREIGN KEY (business_id) REFERENCES businesses(id),
    CONSTRAINT fk_credit_ledger_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE business_unlocks (
    id              char(36) NOT NULL,
    user_id         char(36) NOT NULL,
    business_id     char(36) NOT NULL,
    subscription_id char(36) NOT NULL,
    unlocked_at     datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY ux_business_unlocks (subscription_id, business_id),
    KEY ix_unlocks_user_business (user_id, business_id),
    CONSTRAINT fk_business_unlocks_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_business_unlocks_business FOREIGN KEY (business_id) REFERENCES businesses(id),
    CONSTRAINT fk_business_unlocks_subscription FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE listing_subscriptions (
    id           char(36) NOT NULL,
    business_id  char(36) NOT NULL,
    purchased_by char(36) NOT NULL,
    plan_id      char(36) NOT NULL,
    status       ENUM('ACTIVE','CANCELLED','EXPIRED','PENDING_PAYMENT') NOT NULL,
    starts_at    datetime(6),
    ends_at      datetime(6),
    amount       decimal(38,2) NOT NULL,
    currency     varchar(10) NOT NULL,
    payment_id   char(36),
    created_at   datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at   datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_listing_business (business_id, created_at),
    CONSTRAINT fk_listing_business FOREIGN KEY (business_id) REFERENCES businesses(id),
    CONSTRAINT fk_listing_purchaser FOREIGN KEY (purchased_by) REFERENCES users(id),
    CONSTRAINT fk_listing_plan FOREIGN KEY (plan_id) REFERENCES plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE payments (
    id           char(36) NOT NULL,
    user_id      char(36) NOT NULL,
    purpose      ENUM('LISTING','RESEARCHER_PLAN') NOT NULL,
    reference_id char(36),
    amount       decimal(38,2) NOT NULL,
    currency     varchar(10) NOT NULL,
    provider     varchar(40) NOT NULL DEFAULT 'MANUAL',
    provider_ref varchar(120),
    status       ENUM('FAILED','PAID','PENDING','REFUNDED') NOT NULL,
    recorded_by  char(36),
    created_at   datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    paid_at      datetime(6),
    PRIMARY KEY (id),
    UNIQUE KEY ux_payments_provider_ref (provider_ref),
    KEY ix_payments_user (user_id, created_at),
    KEY ix_payments_status (status),
    CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_payments_recorder FOREIGN KEY (recorded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE profile_requirements (
    id          char(36) NOT NULL,
    role        ENUM('ADMIN','AUDITOR','BUSINESS','RESEARCHER') NOT NULL,
    kind        ENUM('DOCUMENT','FIELD') NOT NULL,
    name        varchar(80) NOT NULL,
    is_required bit(1) NOT NULL DEFAULT b'1',
    PRIMARY KEY (id),
    UNIQUE KEY ux_profile_requirements (role, kind, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE saved_searches (
    id         char(36) NOT NULL,
    user_id    char(36) NOT NULL,
    name       varchar(120) NOT NULL,
    query_json json NOT NULL,
    created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_saved_searches_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE app_settings (
    setting_key   varchar(80) NOT NULL,
    setting_value text NOT NULL,
    updated_at    datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
