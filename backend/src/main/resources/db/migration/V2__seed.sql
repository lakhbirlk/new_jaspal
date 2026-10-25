-- Permission catalogue, role permissions, plans and profile requirements.

INSERT INTO permissions (id, code) VALUES
    (gen_random_uuid(), 'business:read'),
    (gen_random_uuid(), 'business:update'),
    (gen_random_uuid(), 'business:search'),
    (gen_random_uuid(), 'business:unlock'),
    (gen_random_uuid(), 'user:read'),
    (gen_random_uuid(), 'user:update'),
    (gen_random_uuid(), 'document:upload'),
    (gen_random_uuid(), 'document:read'),
    (gen_random_uuid(), 'document:review'),
    (gen_random_uuid(), 'policy:manage'),
    (gen_random_uuid(), 'audit:read'),
    (gen_random_uuid(), 'audit:note'),
    (gen_random_uuid(), 'subscription:manage'),
    (gen_random_uuid(), 'plan:read'),
    (gen_random_uuid(), 'plan:manage'),
    (gen_random_uuid(), 'listing:manage'),
    (gen_random_uuid(), 'payment:read'),
    (gen_random_uuid(), 'payment:manage'),
    (gen_random_uuid(), 'saved_search:manage'),
    (gen_random_uuid(), 'dashboard:read');

INSERT INTO role_permissions (id, role, permission_id)
SELECT gen_random_uuid(), r.role, p.id
FROM (VALUES
    ('RESEARCHER', 'business:read'),
    ('RESEARCHER', 'business:search'),
    ('RESEARCHER', 'business:unlock'),
    ('RESEARCHER', 'subscription:manage'),
    ('RESEARCHER', 'plan:read'),
    ('RESEARCHER', 'saved_search:manage'),
    ('BUSINESS', 'business:read'),
    ('BUSINESS', 'business:update'),
    ('BUSINESS', 'document:upload'),
    ('BUSINESS', 'document:read'),
    ('BUSINESS', 'listing:manage'),
    ('BUSINESS', 'plan:read'),
    ('BUSINESS', 'payment:read'),
    ('AUDITOR', 'business:read'),
    ('AUDITOR', 'document:read'),
    ('AUDITOR', 'audit:note'),
    ('ADMIN', 'business:read'),
    ('ADMIN', 'business:update'),
    ('ADMIN', 'business:search'),
    ('ADMIN', 'business:unlock'),
    ('ADMIN', 'user:read'),
    ('ADMIN', 'user:update'),
    ('ADMIN', 'document:upload'),
    ('ADMIN', 'document:read'),
    ('ADMIN', 'document:review'),
    ('ADMIN', 'policy:manage'),
    ('ADMIN', 'audit:read'),
    ('ADMIN', 'audit:note'),
    ('ADMIN', 'subscription:manage'),
    ('ADMIN', 'plan:read'),
    ('ADMIN', 'plan:manage'),
    ('ADMIN', 'listing:manage'),
    ('ADMIN', 'payment:read'),
    ('ADMIN', 'payment:manage'),
    ('ADMIN', 'saved_search:manage'),
    ('ADMIN', 'dashboard:read')
) AS r(role, code)
JOIN permissions p ON p.code = r.code;

INSERT INTO plans (id, code, name, audience, credits, duration_months, price_amount, currency, is_active) VALUES
    (gen_random_uuid(), 'BASIC', 'Basic', 'RESEARCHER', 5, 1, 0, 'INR', true),
    (gen_random_uuid(), 'LISTING_1M', 'Listing 1 month', 'BUSINESS', NULL, 1, 4999, 'INR', true),
    (gen_random_uuid(), 'LISTING_1Y', 'Listing 1 year', 'BUSINESS', NULL, 12, 49990, 'INR', true),
    (gen_random_uuid(), 'LISTING_3Y', 'Listing 3 years', 'BUSINESS', NULL, 36, 129990, 'INR', true);

INSERT INTO profile_requirements (id, role, kind, name, is_required) VALUES
    (gen_random_uuid(), 'RESEARCHER', 'FIELD', 'organization', true),
    (gen_random_uuid(), 'RESEARCHER', 'FIELD', 'designation', true),
    (gen_random_uuid(), 'RESEARCHER', 'FIELD', 'phone', true),
    (gen_random_uuid(), 'RESEARCHER', 'FIELD', 'purpose_of_research', true),
    (gen_random_uuid(), 'RESEARCHER', 'DOCUMENT', 'ID_PROOF', true),
    (gen_random_uuid(), 'BUSINESS', 'FIELD', 'legal_name', true),
    (gen_random_uuid(), 'BUSINESS', 'FIELD', 'registration_number', true),
    (gen_random_uuid(), 'BUSINESS', 'FIELD', 'tax_id', true),
    (gen_random_uuid(), 'BUSINESS', 'FIELD', 'industry', true),
    (gen_random_uuid(), 'BUSINESS', 'FIELD', 'category', true),
    (gen_random_uuid(), 'BUSINESS', 'FIELD', 'address_line', true),
    (gen_random_uuid(), 'BUSINESS', 'FIELD', 'city', true),
    (gen_random_uuid(), 'BUSINESS', 'FIELD', 'country', true),
    (gen_random_uuid(), 'BUSINESS', 'FIELD', 'contact_person_name', true),
    (gen_random_uuid(), 'BUSINESS', 'FIELD', 'contact_person_phone', true),
    (gen_random_uuid(), 'BUSINESS', 'FIELD', 'description', true),
    (gen_random_uuid(), 'BUSINESS', 'DOCUMENT', 'BUSINESS_LICENSE', true),
    (gen_random_uuid(), 'BUSINESS', 'DOCUMENT', 'TAX_CERTIFICATE', true);

INSERT INTO app_settings (setting_key, setting_value) VALUES
    ('password.min.length', '10'),
    ('login.max.failures', '5'),
    ('login.lock.minutes', '15'),
    ('mfa.required.roles', 'ADMIN,AUDITOR');
