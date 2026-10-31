-- The entry-level researcher plan is priced at ₹1,000 for one month.
UPDATE plans
SET price_amount = 1000,
    updated_at = NOW()
WHERE code = 'BASIC';
