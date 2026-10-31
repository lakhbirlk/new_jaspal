-- Indexes supporting the admin payment dashboard and transaction log queries.

-- Status + date range scans (dashboard totals, filtered transaction lists).
CREATE INDEX ix_payments_status_created_at ON payments(status, created_at);

-- Gateway / payment method filtering.
CREATE INDEX ix_payments_provider ON payments(provider);

-- Per-customer transaction history.
CREATE INDEX ix_payments_user_created_at ON payments(user_id, created_at);

-- Dashboard aggregation: sum(amount) over a status within a date window.
CREATE INDEX ix_payments_status_created_amount ON payments(status, created_at, amount);
