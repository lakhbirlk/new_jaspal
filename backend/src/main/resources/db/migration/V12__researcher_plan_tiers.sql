-- Three successive researcher plans: a free starter tier, a 3-month paid tier and a
-- 12-month paid tier. Prices follow the public pricing (₹2,500 per 3 months); credits
-- and duration step up with each tier. Idempotent on the plan code.
INSERT INTO plans (id, code, name, audience, credits, duration_months, price_amount, currency, is_active)
VALUES
    (UUID(), 'BASIC',        'Basic',         'RESEARCHER',   5,  1,      0, 'INR', b'1'),
    (UUID(), 'RESEARCH_3M',  'Professional',  'RESEARCHER',  25,  3,   2500, 'INR', b'1'),
    (UUID(), 'RESEARCH_12M', 'Enterprise',    'RESEARCHER', 120, 12,   8500, 'INR', b'1')
ON DUPLICATE KEY UPDATE
    name            = VALUES(name),
    audience        = VALUES(audience),
    credits         = VALUES(credits),
    duration_months = VALUES(duration_months),
    price_amount    = VALUES(price_amount),
    currency        = VALUES(currency),
    is_active       = VALUES(is_active),
    updated_at      = NOW();
