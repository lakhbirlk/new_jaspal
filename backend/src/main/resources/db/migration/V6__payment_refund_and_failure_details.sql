-- Payment dashboard needs refund and failure detail that the original schema did not
-- persist. These columns are additive and nullable, so existing rows stay valid.

ALTER TABLE payments ADD COLUMN refunded_at datetime(6);
ALTER TABLE payments ADD COLUMN refund_reason text;
ALTER TABLE payments ADD COLUMN failure_reason text;

-- Refund reporting scans by refund date.
CREATE INDEX ix_payments_refunded_at ON payments(refunded_at);
