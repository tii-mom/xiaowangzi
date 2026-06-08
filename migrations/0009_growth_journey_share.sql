PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS growth_goals (
    id                         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id                    INTEGER NOT NULL REFERENCES users(id),
    agent_profile_id            INTEGER REFERENCES agent_profiles(id),
    title                      TEXT NOT NULL,
    change_target              TEXT NOT NULL,
    anti_vision                TEXT NOT NULL,
    minimum_viable_vision       TEXT NOT NULL,
    daily_lever                TEXT NOT NULL,
    status                     TEXT NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active', 'archived', 'completed')),
    source_share_artifact_id    INTEGER,
    created_at                 TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_growth_goals_user_status
ON growth_goals(user_id, status, updated_at);

CREATE TABLE IF NOT EXISTS growth_daily_practices (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id            INTEGER NOT NULL REFERENCES users(id),
    growth_goal_id      INTEGER NOT NULL REFERENCES growth_goals(id),
    practice_date      TEXT NOT NULL,
    day_number         INTEGER NOT NULL DEFAULT 1,
    daily_lever        TEXT NOT NULL,
    status             TEXT NOT NULL DEFAULT 'planned'
                       CHECK (status IN ('planned', 'completed', 'skipped')),
    streak_count       INTEGER NOT NULL DEFAULT 0,
    completed_at       TEXT,
    created_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(growth_goal_id, practice_date)
);

CREATE INDEX IF NOT EXISTS idx_growth_practices_user_date
ON growth_daily_practices(user_id, practice_date);

CREATE TABLE IF NOT EXISTS growth_reflections (
    id                         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id                    INTEGER NOT NULL REFERENCES users(id),
    growth_goal_id              INTEGER NOT NULL REFERENCES growth_goals(id),
    growth_daily_practice_id    INTEGER NOT NULL REFERENCES growth_daily_practices(id),
    completed_text             TEXT NOT NULL,
    tacit_insight              TEXT NOT NULL,
    next_adjustment            TEXT NOT NULL,
    created_at                 TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_growth_reflections_user_created
ON growth_reflections(user_id, created_at);

CREATE TABLE IF NOT EXISTS growth_snapshots (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id            INTEGER NOT NULL REFERENCES users(id),
    growth_goal_id      INTEGER NOT NULL REFERENCES growth_goals(id),
    interval_days      INTEGER NOT NULL CHECK (interval_days IN (7, 30)),
    completed_days     INTEGER NOT NULL DEFAULT 0,
    summary            TEXT NOT NULL,
    created_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_growth_snapshots_user_created
ON growth_snapshots(user_id, created_at);

CREATE TABLE IF NOT EXISTS share_artifacts (
    id                         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id                    INTEGER NOT NULL REFERENCES users(id),
    growth_goal_id              INTEGER NOT NULL REFERENCES growth_goals(id),
    growth_daily_practice_id    INTEGER REFERENCES growth_daily_practices(id),
    slug                       TEXT NOT NULL UNIQUE,
    title                      TEXT NOT NULL,
    goal_theme                 TEXT NOT NULL,
    day_number                 INTEGER NOT NULL DEFAULT 1,
    today_action               TEXT NOT NULL,
    progress_note              TEXT NOT NULL,
    public_summary             TEXT NOT NULL,
    status                     TEXT NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active', 'revoked')),
    view_count                 INTEGER NOT NULL DEFAULT 0,
    start_count                INTEGER NOT NULL DEFAULT 0,
    created_at                 TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_share_artifacts_slug_status
ON share_artifacts(slug, status);

CREATE INDEX IF NOT EXISTS idx_share_artifacts_user_created
ON share_artifacts(user_id, created_at);
