-- Company financials published for research visibility: net profit, net worth and the
-- 36-month monthly turnover series that drives the trend chart on the company database.

ALTER TABLE businesses
    ADD COLUMN net_profit       decimal(38,2),
    ADD COLUMN net_worth        decimal(38,2),
    ADD COLUMN monthly_turnover json;

INSERT INTO field_policies (id, role, resource, field, access, unlock_state) VALUES
-- Research members read the published financials; identity and contacts stay behind unlock.
(UUID(), 'RESEARCHER', 'business', 'net_profit', 'READ', 'LOCKED'),
(UUID(), 'RESEARCHER', 'business', 'net_worth', 'READ', 'LOCKED'),
(UUID(), 'RESEARCHER', 'business', 'monthly_turnover', 'READ', 'LOCKED'),
(UUID(), 'RESEARCHER', 'business', 'net_profit', 'READ', 'UNLOCKED'),
(UUID(), 'RESEARCHER', 'business', 'net_worth', 'READ', 'UNLOCKED'),
(UUID(), 'RESEARCHER', 'business', 'monthly_turnover', 'READ', 'UNLOCKED'),

-- Business owners publish and maintain their own financials.
(UUID(), 'BUSINESS', 'business', 'net_profit', 'WRITE', 'ANY'),
(UUID(), 'BUSINESS', 'business', 'net_worth', 'WRITE', 'ANY'),
(UUID(), 'BUSINESS', 'business', 'monthly_turnover', 'WRITE', 'ANY'),

-- Auditor and admin read access.
(UUID(), 'AUDITOR', 'business', 'net_profit', 'READ', 'ANY'),
(UUID(), 'AUDITOR', 'business', 'net_worth', 'READ', 'ANY'),
(UUID(), 'AUDITOR', 'business', 'monthly_turnover', 'READ', 'ANY'),
(UUID(), 'ADMIN', 'business', 'net_profit', 'WRITE', 'ANY'),
(UUID(), 'ADMIN', 'business', 'net_worth', 'WRITE', 'ANY'),
(UUID(), 'ADMIN', 'business', 'monthly_turnover', 'WRITE', 'ANY');
