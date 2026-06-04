PRAGMA foreign_keys = ON;

CREATE UNIQUE INDEX IF NOT EXISTS idx_token_ledger_bufpay_purchase_once
ON token_ledger(source, source_id, type)
WHERE source = 'bufpay' AND type = 'purchase';
