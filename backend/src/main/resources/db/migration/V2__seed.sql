-- Permission catalogue, role permissions, plans and profile requirements.

INSERT INTO permissions (id, code) VALUES
    (UUID(), 'business:read'),
    (UUID(), 'business:update'),
    (UUID(), 'business:search'),
    (UUID(), 'business:unlock'),
    (UUID(), 'user:read'),
    (UUID(), 'user:update'),
    (UUID(), 'document:upload'),
    (UUID(), 'document:read'),
    (UUID(), 'document:review'),
    (UUID(), 'policy:manage'),
    (UUID(), 'audit:read'),
    (UUID(), 'audit:note'),
    (UUID(), 'subscription:manage'),
    (UUID(), 'plan:read'),
    (UUID(), 'plan:manage'),
    (UUID(), 'listing:manage'),
    (UUID(), 'payment:read'),
    (UUID(), 'payment:manage'),
    (UUID(), 'saved_search:manage'),
    (UUID(), 'dashboard:read');

INSERT INTO role_permissions (id, role, permission_id)
SELECT UUID(), r.role, p.id
FROM (
    SELECT 'RESEARCHER' AS role, 'business:read' AS code
    UNION ALL SELECT 'RESEARCHER', 'business:search'
    UNION ALL SELECT 'RESEARCHER', 'business:unlock'
    UNION ALL SELECT 'RESEARCHER', 'subscription:manage'
    UNION ALL SELECT 'RESEARCHER', 'plan:read'
    UNION ALL SELECT 'RESEARCHER', 'saved_search:manage'
    UNION ALL SELECT 'BUSINESS', 'business:read'
    UNION ALL SELECT 'BUSINESS', 'business:update'
    UNION ALL SELECT 'BUSINESS', 'document:upload'
    UNION ALL SELECT 'BUSINESS', 'document:read'
    UNION ALL SELECT 'BUSINESS', 'listing:manage'
    UNION ALL SELECT 'BUSINESS', 'plan:read'
    UNION ALL SELECT 'BUSINESS', 'payment:read'
    UNION ALL SELECT 'AUDITOR', 'business:read'
    UNION ALL SELECT 'AUDITOR', 'document:read'
    UNION ALL SELECT 'AUDITOR', 'audit:note'
    UNION ALL SELECT 'ADMIN', 'business:read'
    UNION ALL SELECT 'ADMIN', 'business:update'
    UNION ALL SELECT 'ADMIN', 'business:search'
    UNION ALL SELECT 'ADMIN', 'business:unlock'
    UNION ALL SELECT 'ADMIN', 'user:read'
    UNION ALL SELECT 'ADMIN', 'user:update'
    UNION ALL SELECT 'ADMIN', 'document:upload'
    UNION ALL SELECT 'ADMIN', 'document:read'
    UNION ALL SELECT 'ADMIN', 'document:review'
    UNION ALL SELECT 'ADMIN', 'policy:manage'
    UNION ALL SELECT 'ADMIN', 'audit:read'
    UNION ALL SELECT 'ADMIN', 'audit:note'
    UNION ALL SELECT 'ADMIN', 'subscription:manage'
    UNION ALL SELECT 'ADMIN', 'plan:read'
    UNION ALL SELECT 'ADMIN', 'plan:manage'
    UNION ALL SELECT 'ADMIN', 'listing:manage'
    UNION ALL SELECT 'ADMIN', 'payment:read'
    UNION ALL SELECT 'ADMIN', 'payment:manage'
    UNION ALL SELECT 'ADMIN', 'saved_search:manage'
    UNION ALL SELECT 'ADMIN', 'dashboard:read'
) AS r
JOIN permissions p ON p.code = r.code;

INSERT INTO plans (id, code, name, audience, credits, duration_months, price_amount, currency, is_active) VALUES
    (UUID(), 'BASIC', 'Basic', 'RESEARCHER', 5, 1, 0, 'INR', b'1'),
    (UUID(), 'LISTING_1M', 'Listing 1 month', 'BUSINESS', NULL, 1, 4999, 'INR', b'1'),
    (UUID(), 'LISTING_1Y', 'Listing 1 year', 'BUSINESS', NULL, 12, 49990, 'INR', b'1'),
    (UUID(), 'LISTING_3Y', 'Listing 3 years', 'BUSINESS', NULL, 36, 129990, 'INR', b'1');

INSERT INTO profile_requirements (id, role, kind, name, is_required) VALUES
    (UUID(), 'RESEARCHER', 'FIELD', 'organization', b'1'),
    (UUID(), 'RESEARCHER', 'FIELD', 'designation', b'1'),
    (UUID(), 'RESEARCHER', 'FIELD', 'phone', b'1'),
    (UUID(), 'RESEARCHER', 'FIELD', 'purpose_of_research', b'1'),
    (UUID(), 'RESEARCHER', 'DOCUMENT', 'ID_PROOF', b'1'),
    (UUID(), 'BUSINESS', 'FIELD', 'legal_name', b'1'),
    (UUID(), 'BUSINESS', 'FIELD', 'registration_number', b'1'),
    (UUID(), 'BUSINESS', 'FIELD', 'tax_id', b'1'),
    (UUID(), 'BUSINESS', 'FIELD', 'industry', b'1'),
    (UUID(), 'BUSINESS', 'FIELD', 'category', b'1'),
    (UUID(), 'BUSINESS', 'FIELD', 'address_line', b'1'),
    (UUID(), 'BUSINESS', 'FIELD', 'city', b'1'),
    (UUID(), 'BUSINESS', 'FIELD', 'country', b'1'),
    (UUID(), 'BUSINESS', 'FIELD', 'contact_person_name', b'1'),
    (UUID(), 'BUSINESS', 'FIELD', 'contact_person_phone', b'1'),
    (UUID(), 'BUSINESS', 'FIELD', 'description', b'1'),
    (UUID(), 'BUSINESS', 'DOCUMENT', 'BUSINESS_LICENSE', b'1'),
    (UUID(), 'BUSINESS', 'DOCUMENT', 'TAX_CERTIFICATE', b'1');

INSERT INTO app_settings (setting_key, setting_value) VALUES
    ('password.min.length', '10'),
    ('login.max.failures', '5'),
    ('login.lock.minutes', '15'),
    ('mfa.required.roles', 'ADMIN,AUDITOR');
