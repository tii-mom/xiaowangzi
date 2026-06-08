PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS agent_memories (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id),
    agent_profile_id INTEGER REFERENCES agent_profiles(id),
    memory_type      TEXT NOT NULL DEFAULT 'preference'
                     CHECK (memory_type IN ('preference', 'profile', 'goal', 'boundary', 'important_event', 'summary')),
    content          TEXT NOT NULL,
    source           TEXT NOT NULL DEFAULT 'chat',
    confidence       REAL NOT NULL DEFAULT 0.7,
    status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'archived')),
    created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_memories_user_status
ON agent_memories(user_id, status, updated_at);

CREATE TABLE IF NOT EXISTS agent_tool_calls (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id                  INTEGER NOT NULL REFERENCES users(id),
    agent_profile_id          INTEGER REFERENCES agent_profiles(id),
    thread_id                TEXT,
    channel                  TEXT NOT NULL,
    tool_name                TEXT NOT NULL,
    provider                 TEXT NOT NULL,
    query                    TEXT NOT NULL,
    status                   TEXT NOT NULL CHECK (status IN ('skipped', 'ok', 'error', 'disabled')),
    result_summary           TEXT,
    error                    TEXT,
    duration_ms              INTEGER NOT NULL DEFAULT 0,
    estimated_cost_cents     INTEGER NOT NULL DEFAULT 0,
    created_at               TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_user_created
ON agent_tool_calls(user_id, created_at);

CREATE TABLE IF NOT EXISTS agent_learning_events (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id),
    agent_profile_id INTEGER REFERENCES agent_profiles(id),
    event_type       TEXT NOT NULL,
    payload_json     TEXT,
    created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_learning_events_user_created
ON agent_learning_events(user_id, created_at);
