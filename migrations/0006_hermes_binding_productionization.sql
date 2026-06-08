PRAGMA foreign_keys = OFF;

-- 1. 创建新表新结构支持 pending/consumed/expired/revoked，以及 agent_profile_id, channel, consumed_at 字段
CREATE TABLE IF NOT EXISTS bind_codes_new (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    code            TEXT NOT NULL UNIQUE,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    agent_profile_id INTEGER REFERENCES agent_profiles(id),
    hermes_user_id  TEXT,
    channel         TEXT NOT NULL DEFAULT 'wechat',
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'consumed', 'expired', 'revoked')),
    expires_at      TEXT NOT NULL,
    consumed_at     TEXT,
    attempts        INTEGER NOT NULL DEFAULT 0,
    metadata_json   TEXT,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. 复制老数据映射 status 'used' -> 'consumed'
INSERT INTO bind_codes_new (id, code, user_id, status, expires_at, created_at, hermes_user_id)
SELECT 
    id, 
    code, 
    user_id, 
    CASE WHEN status = 'used' THEN 'consumed' ELSE status END, 
    expires_at, 
    created_at,
    hermes_user_id
FROM bind_codes;

-- 3. 彻底替换老表
DROP TABLE bind_codes;
ALTER TABLE bind_codes_new RENAME TO bind_codes;

-- 4. 重新建立索引
CREATE INDEX IF NOT EXISTS idx_bind_codes_code ON bind_codes(code);
CREATE INDEX IF NOT EXISTS idx_bind_codes_status ON bind_codes(status);
CREATE INDEX IF NOT EXISTS idx_bind_codes_user_id ON bind_codes(user_id);

-- 5. 创建 hermes_messages 表用于 webhook 幂等性与消息去重
CREATE TABLE IF NOT EXISTS hermes_messages (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id       TEXT NOT NULL UNIQUE,
    hermes_user_id   TEXT NOT NULL,
    message_type     TEXT NOT NULL,
    text_preview     TEXT,
    status           TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
    action           TEXT,
    created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at     TEXT,
    metadata_json    TEXT
);

-- 6. 创建 微信 专属的 active 偏独特索引，确保 active bindings 一对一
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_bindings_wechat_external_active
ON agent_bindings(external_id)
WHERE channel = 'wechat' AND status = 'active' AND external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_bindings_profile_wechat_active
ON agent_bindings(agent_profile_id)
WHERE channel = 'wechat' AND status = 'active';

PRAGMA foreign_keys = ON;
