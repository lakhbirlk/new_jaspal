-- Seed dummy payment data for testing and dashboard verification

-- Successful Listing Payments (Stripe)
INSERT INTO payments (
    id, user_id, purpose, reference_id, amount, currency, provider, provider_ref, status, created_at, paid_at
)
SELECT
    UUID(),
    id,
    'LISTING',
    UUID(),
    4999.00,
    'INR',
    'STRIPE',
    CONCAT('st_test_', LOWER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 12))),
    'PAID',
    DATE_SUB(NOW(), INTERVAL 10 DAY),
    DATE_SUB(NOW(), INTERVAL 10 DAY)
FROM users LIMIT 5;

-- Successful Researcher Plan Payments (Razorpay)
INSERT INTO payments (
    id, user_id, purpose, reference_id, amount, currency, provider, provider_ref, status, created_at, paid_at
)
SELECT
    UUID(),
    id,
    'RESEARCHER_PLAN',
    UUID(),
    1500.00,
    'INR',
    'RAZORPAY',
    CONCAT('pay_', LOWER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 12))),
    'PAID',
    DATE_SUB(NOW(), INTERVAL 5 DAY),
    DATE_SUB(NOW(), INTERVAL 5 DAY)
FROM users LIMIT 5 OFFSET 5;

-- A failed payment (Stripe)
INSERT INTO payments (
    id, user_id, purpose, amount, currency, provider, status, created_at, failure_reason
)
SELECT
    UUID(),
    id,
    'LISTING',
    4999.00,
    'INR',
    'STRIPE',
    'FAILED',
    DATE_SUB(NOW(), INTERVAL 2 DAY),
    'Insufficient funds'
FROM users LIMIT 1 OFFSET 10;

-- A refunded payment (Manual)
INSERT INTO payments (
    id, user_id, purpose, amount, currency, provider, status, created_at, paid_at, refunded_at, refund_reason
)
SELECT
    UUID(),
    id,
    'LISTING',
    49990.00,
    'INR',
    'MANUAL',
    'REFUNDED',
    DATE_SUB(NOW(), INTERVAL 20 DAY),
    DATE_SUB(NOW(), INTERVAL 19 DAY),
    DATE_SUB(NOW(), INTERVAL 15 DAY),
    'Customer requested cancellation'
FROM users LIMIT 1 OFFSET 11;

-- A pending payment (Manual)
INSERT INTO payments (
    id, user_id, purpose, amount, currency, provider, status, created_at
)
SELECT
    UUID(),
    id,
    'LISTING',
    4999.00,
    'INR',
    'MANUAL',
    'PENDING',
    DATE_SUB(NOW(), INTERVAL 1 DAY)
FROM users LIMIT 1 OFFSET 12;
