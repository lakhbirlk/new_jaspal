-- Multi-role business directory platform - initial schema.

CREATE TABLE users (
    id                 uuid PRIMARY KEY,
    email              varchar(320) NOT NULL UNIQUE,
    password_hash      text NOT NULL,
    role               varchar(20) NOT NULL CHECK (role IN ('ADMIN','AUDITOR','RESEARCHER','BUSINESS')),
    status             varchar(30) NOT NULL CHECK (status IN ('PENDING_EMAIL','PENDING_PROFILE','PENDING_REVIEW','ACTIVE','REJECTED','SUSPENDED')),
    email_verified_at  timestamptz,
    mfa_secret         text,
    mfa_enabled        boolean NOT NULL DEFAULT false,
    failed_login_count integer NOT NULL DEFAULT 0,
    locked_until       timestamptz,
    full_name          varchar(200) NOT NULL,
    submitted_at       timestamptz,
    review_note        text,
    token_version      integer NOT NULL DEFAULT 0,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_users_role_status ON users(role, status);

CREATE TABLE researcher_profiles (
    user_id           uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name         varchar(200),
    organization      varchar(200),
    designation       varchar(200),
    phone             varchar(40),
    purpose_of_research text,
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE businesses (
    id                    uuid PRIMARY KEY,
    owner_user_id         uuid REFERENCES users(id),
    legal_name            varchar(300) NOT NULL,
    trade_name            varchar(300),
    registration_number   varchar(100),
    tax_id                text,
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
    annual_revenue        numeric(18,2),
    employee_count        integer,
    bank_details          text,
    description           text,
    verification_status   varchar(20) NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN ('UNVERIFIED','VERIFIED','REJECTED')),
    listed_until          timestamptz,
    admin_listing_status  varchar(20) NOT NULL DEFAULT 'UNLISTED' CHECK (admin_listing_status IN ('UNLISTED','LISTED')),
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_businesses_owner ON businesses(owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE INDEX ix_businesses_industry_city ON businesses(industry, city);
CREATE INDEX ix_businesses_fts ON businesses USING GIN (
    to_tsvector('english',
        coalesce(legal_name,'') || ' ' || coalesce(trade_name,'') || ' ' ||
        coalesce(industry,'') || ' ' || coalesce(category,'') || ' ' ||
        coalesce(city,'') || ' ' || coalesce(country,'') || ' ' ||
        coalesce(description,''))
);

CREATE TABLE documents (
    id                 uuid PRIMARY KEY,
    owner_user_id      uuid NOT NULL REFERENCES users(id),
    business_id        uuid REFERENCES businesses(id),
    doc_type           varchar(40) NOT NULL CHECK (doc_type IN ('ID_PROOF','BUSINESS_LICENSE','TAX_CERTIFICATE','ADDRESS_PROOF','OTHER')),
    original_filename  varchar(255) NOT NULL,
    content            bytea NOT NULL,
    mime_type          varchar(120) NOT NULL,
    size_bytes         bigint NOT NULL,
    checksum           varchar(64) NOT NULL,
    status             varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    reviewed_by        uuid REFERENCES users(id),
    reviewed_at        timestamptz,
    rejection_reason   text,
    created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_documents_owner ON documents(owner_user_id);
CREATE INDEX ix_documents_status ON documents(status);

CREATE TABLE permissions (
    id   uuid PRIMARY KEY,
    code varchar(80) NOT NULL UNIQUE
);

CREATE TABLE role_permissions (
    id            uuid PRIMARY KEY,
    role          varchar(20) NOT NULL CHECK (role IN ('ADMIN','AUDITOR','RESEARCHER','BUSINESS')),
    permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE (role, permission_id)
);

CREATE TABLE field_policies (
    id            uuid PRIMARY KEY,
    role          varchar(20) NOT NULL,
    resource      varchar(60) NOT NULL,
    field         varchar(80) NOT NULL,
    access        varchar(10) NOT NULL CHECK (access IN ('HIDDEN','MASKED','READ','WRITE')),
    unlock_state  varchar(10) NOT NULL DEFAULT 'ANY' CHECK (unlock_state IN ('ANY','LOCKED','UNLOCKED')),
    updated_by    uuid REFERENCES users(id),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (role, resource, field, unlock_state)
);

CREATE TABLE user_policy_overrides (
    id           uuid PRIMARY KEY,
    user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource     varchar(60) NOT NULL,
    field        varchar(80) NOT NULL,
    access       varchar(10) NOT NULL CHECK (access IN ('HIDDEN','MASKED','READ','WRITE')),
    unlock_state varchar(10) NOT NULL DEFAULT 'ANY' CHECK (unlock_state IN ('ANY','LOCKED','UNLOCKED')),
    expires_at   timestamptz,
    updated_by   uuid REFERENCES users(id),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, resource, field, unlock_state)
);

CREATE TABLE audit_logs (
    id             uuid PRIMARY KEY,
    actor_user_id  uuid REFERENCES users(id),
    action         varchar(100) NOT NULL,
    resource_type  varchar(60) NOT NULL,
    resource_id    uuid,
    before_state   jsonb,
    after_state    jsonb,
    ip             varchar(64),
    user_agent     text,
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_actor_time ON audit_logs(actor_user_id, created_at);
CREATE INDEX ix_audit_resource ON audit_logs(resource_type, resource_id);

CREATE TABLE refresh_tokens (
    id         uuid PRIMARY KEY,
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash varchar(64) NOT NULL UNIQUE,
    family_id  uuid NOT NULL,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    ip         varchar(64),
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_refresh_family ON refresh_tokens(family_id);
CREATE INDEX ix_refresh_user ON refresh_tokens(user_id);

CREATE TABLE email_tokens (
    id         uuid PRIMARY KEY,
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose    varchar(20) NOT NULL CHECK (purpose IN ('VERIFY','RESET','INVITE')),
    token_hash varchar(64) NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at    timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE research_access_log (
    id                uuid PRIMARY KEY,
    researcher_user_id uuid NOT NULL REFERENCES users(id),
    business_id       uuid REFERENCES businesses(id),
    query             text,
    viewed_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE plans (
    id              uuid PRIMARY KEY,
    code            varchar(40) NOT NULL UNIQUE,
    name            varchar(120) NOT NULL,
    audience        varchar(20) NOT NULL CHECK (audience IN ('RESEARCHER','BUSINESS')),
    credits         integer,
    duration_months integer NOT NULL,
    price_amount    numeric(18,2) NOT NULL DEFAULT 0,
    currency        varchar(10) NOT NULL DEFAULT 'INR',
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
    id                uuid PRIMARY KEY,
    user_id           uuid NOT NULL REFERENCES users(id),
    plan_id           uuid NOT NULL REFERENCES plans(id),
    status            varchar(20) NOT NULL CHECK (status IN ('ACTIVE','EXPIRED','CANCELLED')),
    starts_at         timestamptz NOT NULL,
    ends_at           timestamptz NOT NULL,
    credits_granted   integer NOT NULL,
    credits_remaining integer NOT NULL,
    cancelled_at      timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_subscription_one_active ON subscriptions(user_id) WHERE status = 'ACTIVE';
CREATE INDEX ix_subscriptions_ends ON subscriptions(status, ends_at);

CREATE TABLE credit_ledger (
    id              uuid PRIMARY KEY,
    user_id         uuid NOT NULL REFERENCES users(id),
    subscription_id uuid REFERENCES subscriptions(id),
    entry_type      varchar(20) NOT NULL CHECK (entry_type IN ('GRANT','SPEND','EXPIRE','ADMIN_ADJUST')),
    amount          integer NOT NULL,
    business_id     uuid REFERENCES businesses(id),
    balance_after   integer NOT NULL,
    reason          text,
    created_by      uuid REFERENCES users(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_ledger_user_time ON credit_ledger(user_id, created_at);

CREATE TABLE business_unlocks (
    id              uuid PRIMARY KEY,
    user_id         uuid NOT NULL REFERENCES users(id),
    business_id     uuid NOT NULL REFERENCES businesses(id),
    subscription_id uuid NOT NULL REFERENCES subscriptions(id),
    unlocked_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (subscription_id, business_id)
);
CREATE INDEX ix_unlocks_user_business ON business_unlocks(user_id, business_id);

CREATE TABLE listing_subscriptions (
    id           uuid PRIMARY KEY,
    business_id  uuid NOT NULL REFERENCES businesses(id),
    purchased_by uuid NOT NULL REFERENCES users(id),
    plan_id      uuid NOT NULL REFERENCES plans(id),
    status       varchar(30) NOT NULL CHECK (status IN ('PENDING_PAYMENT','ACTIVE','EXPIRED','CANCELLED')),
    starts_at    timestamptz,
    ends_at      timestamptz,
    amount       numeric(18,2) NOT NULL,
    currency     varchar(10) NOT NULL,
    payment_id   uuid,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_listing_business ON listing_subscriptions(business_id, created_at);

CREATE TABLE payments (
    id           uuid PRIMARY KEY,
    user_id      uuid NOT NULL REFERENCES users(id),
    purpose      varchar(30) NOT NULL CHECK (purpose IN ('LISTING','RESEARCHER_PLAN')),
    reference_id uuid,
    amount       numeric(18,2) NOT NULL,
    currency     varchar(10) NOT NULL,
    provider     varchar(40) NOT NULL DEFAULT 'MANUAL',
    provider_ref varchar(120) UNIQUE,
    status       varchar(20) NOT NULL CHECK (status IN ('PENDING','PAID','FAILED','REFUNDED')),
    recorded_by  uuid REFERENCES users(id),
    created_at   timestamptz NOT NULL DEFAULT now(),
    paid_at      timestamptz
);
CREATE INDEX ix_payments_user ON payments(user_id, created_at);
CREATE INDEX ix_payments_status ON payments(status);

CREATE TABLE profile_requirements (
    id          uuid PRIMARY KEY,
    role        varchar(20) NOT NULL,
    kind        varchar(20) NOT NULL CHECK (kind IN ('FIELD','DOCUMENT')),
    name        varchar(80) NOT NULL,
    is_required boolean NOT NULL DEFAULT true,
    UNIQUE (role, kind, name)
);

CREATE TABLE saved_searches (
    id         uuid PRIMARY KEY,
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       varchar(120) NOT NULL,
    query_json jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_settings (
    setting_key   varchar(80) PRIMARY KEY,
    setting_value text NOT NULL,
    updated_at    timestamptz NOT NULL DEFAULT now()
);
