PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- users: 用户主表
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    hermes_user_id  TEXT UNIQUE,
    wechat_external_id TEXT UNIQUE,
    nickname        TEXT,
    avatar_url      TEXT,
    token_balance   INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'paused', 'banned')),
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_hermes_user_id ON users(hermes_user_id);
CREATE INDEX IF NOT EXISTS idx_users_wechat_external_id ON users(wechat_external_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ---------------------------------------------------------------------------
-- auth_sessions: 用户登录态
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    token       TEXT NOT NULL UNIQUE,
    expires_at  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token);

-- ---------------------------------------------------------------------------
-- bind_codes: 微信绑定一次性配对码
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bind_codes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    code            TEXT NOT NULL UNIQUE,
    user_id         INTEGER REFERENCES users(id),
    hermes_user_id  TEXT,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'used', 'expired')),
    expires_at      TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bind_codes_code ON bind_codes(code);
CREATE INDEX IF NOT EXISTS idx_bind_codes_status ON bind_codes(status);

-- ---------------------------------------------------------------------------
-- subscriptions: 用户订阅
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    plan        TEXT NOT NULL
                CHECK (plan IN ('free_trial', 'monthly', 'quarterly')),
    status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'expired', 'cancelled')),
    started_at  TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ---------------------------------------------------------------------------
-- token_ledger: Token 账本（核心：完整追踪每一笔 Token 变动）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS token_ledger (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL REFERENCES users(id),
    type                TEXT NOT NULL
                        CHECK (type IN ('grant', 'purchase', 'usage', 'refund', 'adjust')),
    delta_tokens        INTEGER NOT NULL,
    balance_after       INTEGER NOT NULL,
    source              TEXT,
    source_id           TEXT,
    model               TEXT,
    input_tokens        INTEGER,
    output_tokens       INTEGER,
    total_tokens        INTEGER,
    estimated_cost_cents INTEGER,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_token_ledger_user_id ON token_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_token_ledger_type ON token_ledger(type);
CREATE INDEX IF NOT EXISTS idx_token_ledger_created_at ON token_ledger(created_at);

-- ---------------------------------------------------------------------------
-- payment_orders: 支付订单
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_orders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    order_id        TEXT NOT NULL UNIQUE,
    bufpay_aoid     TEXT,
    plan            TEXT NOT NULL
                    CHECK (plan IN ('free_trial', 'monthly', 'quarterly')),
    tokens_amount   INTEGER NOT NULL,
    amount_cents    INTEGER NOT NULL,
    pay_type        TEXT,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'paid', 'expired', 'failed', 'refunded')),
    raw_notify_json TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    paid_at         TEXT
);
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_order_id ON payment_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_bufpay_aoid
    ON payment_orders(bufpay_aoid)
    WHERE bufpay_aoid IS NOT NULL;

-- ---------------------------------------------------------------------------
-- user_agents: 用户独立子 Agent
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_agents (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    hermes_agent_id TEXT,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'paused', 'failed')),
    core_doc_hash   TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_user_agents_user_id ON user_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_agents_status ON user_agents(status);

-- ---------------------------------------------------------------------------
-- conversations: 对话记录
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    thread_id       TEXT NOT NULL,
    user_agent_id   INTEGER REFERENCES user_agents(id),
    parent_message_id INTEGER REFERENCES conversations(id),
    role            TEXT NOT NULL
                    CHECK (role IN ('user', 'assistant', 'system')),
    content         TEXT NOT NULL,
    model           TEXT,
    prompt_tokens   INTEGER,
    completion_tokens INTEGER,
    total_tokens    INTEGER,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_thread_id ON conversations(thread_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_agent_id ON conversations(user_agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_parent_message_id ON conversations(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_conversations_role ON conversations(role);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);

-- ---------------------------------------------------------------------------
-- system_events: 系统事件日志
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT NOT NULL,
    payload     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(type);
CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON system_events(created_at);

-- ---------------------------------------------------------------------------
-- admin_audit_logs: 管理员操作审计
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_email TEXT NOT NULL,
    action      TEXT NOT NULL,
    target_type TEXT,
    target_id   TEXT,
    details     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_email ON admin_audit_logs(admin_email);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at);
