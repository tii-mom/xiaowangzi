-- 0004_add_staging_test_plan.sql
-- 使得 payment_orders 和 subscriptions 允许 plan 为 'staging_test_10c'

PRAGMA foreign_keys = OFF;

-- 1. 重构 payment_orders
CREATE TABLE IF NOT EXISTS payment_orders_new (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    order_id        TEXT NOT NULL UNIQUE,
    bufpay_aoid     TEXT,
    plan            TEXT NOT NULL
                    CHECK (plan IN ('free_trial', 'monthly', 'quarterly', 'staging_test_10c')),
    tokens_amount   INTEGER NOT NULL,
    amount_cents    INTEGER NOT NULL,
    pay_type        TEXT,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'paid', 'expired', 'failed', 'refunded')),
    raw_notify_json TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    paid_at         TEXT
);

INSERT INTO payment_orders_new (
    id, user_id, order_id, bufpay_aoid, plan, tokens_amount, amount_cents, pay_type, status, raw_notify_json, created_at, paid_at
)
SELECT id, user_id, order_id, bufpay_aoid, plan, tokens_amount, amount_cents, pay_type, status, raw_notify_json, created_at, paid_at
FROM payment_orders;

DROP TABLE payment_orders;
ALTER TABLE payment_orders_new RENAME TO payment_orders;

CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_order_id ON payment_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_bufpay_aoid
    ON payment_orders(bufpay_aoid)
    WHERE bufpay_aoid IS NOT NULL;


-- 2. 重构 subscriptions
CREATE TABLE IF NOT EXISTS subscriptions_new (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    plan        TEXT NOT NULL
                CHECK (plan IN ('free_trial', 'monthly', 'quarterly', 'staging_test_10c')),
    status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'expired', 'cancelled')),
    started_at  TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO subscriptions_new (
    id, user_id, plan, status, started_at, expires_at, created_at, updated_at
)
SELECT id, user_id, plan, status, started_at, expires_at, created_at, updated_at
FROM subscriptions;

DROP TABLE subscriptions;
ALTER TABLE subscriptions_new RENAME TO subscriptions;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

PRAGMA foreign_keys = ON;
