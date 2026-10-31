-- Subscriptions now start as PENDING_PAYMENT and are activated by the payment flow.
ALTER TABLE subscriptions MODIFY COLUMN status ENUM('ACTIVE','CANCELLED','EXPIRED','PENDING_PAYMENT') NOT NULL;

-- At most one ACTIVE subscription per user. MySQL has no partial indexes, so a stored
-- generated column carries the user id only for the active row and a unique index does
-- the rest.
ALTER TABLE subscriptions
    ADD COLUMN active_user_id char(36)
        GENERATED ALWAYS AS (CASE WHEN status = 'ACTIVE' THEN user_id ELSE NULL END) STORED,
    ADD UNIQUE KEY ux_subscription_one_active (active_user_id);

CREATE INDEX ix_subscriptions_pending ON subscriptions(user_id, status);
