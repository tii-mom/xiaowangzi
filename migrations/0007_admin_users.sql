-- User-level admin RBAC. This keeps ordinary Web/WeChat binding separate from
-- privileged admin access.
CREATE TABLE IF NOT EXISTS admin_users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    role        TEXT NOT NULL DEFAULT 'admin'
                CHECK (role IN ('owner', 'admin', 'support', 'readonly')),
    status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'disabled')),
    granted_by  TEXT,
    reason      TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_status ON admin_users(status);
