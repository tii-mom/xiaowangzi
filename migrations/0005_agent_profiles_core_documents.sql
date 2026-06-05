PRAGMA foreign_keys = ON;

-- 1. 扩充 user_agents 补齐丢失的 agent_name 字段 (修复 LocalAgentManager 潜在的列缺失 bug)
ALTER TABLE user_agents ADD COLUMN agent_name TEXT;

-- 2. 创建 agent_profiles 表
CREATE TABLE IF NOT EXISTS agent_profiles (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    user_agent_id   INTEGER NOT NULL REFERENCES user_agents(id),
    display_name    TEXT NOT NULL,
    avatar_url      TEXT,
    persona_summary TEXT,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    is_primary      INTEGER NOT NULL DEFAULT 1 CHECK (is_primary IN (0, 1)),
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, user_agent_id)
);

-- 每个用户仅允许存在一个 primary 且 active 的 profile
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_profiles_user_primary_active 
ON agent_profiles(user_id) 
WHERE is_primary = 1 AND status = 'active';

-- 3. 创建 agent_core_documents 表
CREATE TABLE IF NOT EXISTS agent_core_documents (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_profile_id INTEGER NOT NULL REFERENCES agent_profiles(id),
    version          INTEGER NOT NULL DEFAULT 1,
    title            TEXT NOT NULL,
    content          TEXT NOT NULL,
    content_hash     TEXT,
    status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
    created_by       TEXT NOT NULL DEFAULT 'system',
    created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_profile_id, version)
);

-- 每个 agent_profile 仅允许有一个 active 的 core document
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_core_docs_active 
ON agent_core_documents(agent_profile_id) 
WHERE status = 'active';

-- 4. 创建 agent_bindings 表
CREATE TABLE IF NOT EXISTS agent_bindings (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_profile_id INTEGER NOT NULL REFERENCES agent_profiles(id),
    channel          TEXT NOT NULL CHECK (channel IN ('web', 'hermes', 'wechat')),
    external_id      TEXT,
    status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'revoked')),
    metadata_json    TEXT,
    created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_profile_id, channel, external_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_bindings_channel_external 
ON agent_bindings(channel, external_id) 
WHERE external_id IS NOT NULL;

-- 5. 扩展 conversations 表
ALTER TABLE conversations ADD COLUMN channel TEXT NOT NULL DEFAULT 'web';
ALTER TABLE conversations ADD COLUMN external_message_id TEXT;
ALTER TABLE conversations ADD COLUMN agent_profile_id INTEGER REFERENCES agent_profiles(id);
ALTER TABLE conversations ADD COLUMN metadata_json TEXT;

-- 6. 为 conversations 建立新字段索引
CREATE INDEX IF NOT EXISTS idx_conversations_user_channel_created_at 
ON conversations(user_id, channel, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_channel_external 
ON conversations(channel, external_message_id) 
WHERE external_message_id IS NOT NULL;
