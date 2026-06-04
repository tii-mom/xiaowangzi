PRAGMA foreign_keys = ON;

CREATE UNIQUE INDEX IF NOT EXISTS idx_token_ledger_deepseek_usage_once
ON token_ledger(source, source_id, type)
WHERE source = 'deepseek' AND type = 'usage';
