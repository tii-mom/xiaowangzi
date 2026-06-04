PRAGMA foreign_keys = ON;

CREATE UNIQUE INDEX IF NOT EXISTS idx_token_ledger_bufpay_purchase_once
ON token_ledger(source, source_id, type)
WHERE source = 'bufpay' AND type = 'purchase';

-- NOTE: payment_orders.status CHECK constraint in 0001_init.sql must include 'processing'.
-- SQLite does not support ALTER TABLE to modify CHECK constraints.
-- For fresh D1 instances, 0001_init.sql has been updated to include 'processing'.
-- For existing instances that were created before this change:
--   1. Create a new table with the updated CHECK
--   2. Copy data from old table
--   3. Drop old table
--   4. Rename new table
-- This must be done manually on the D1 instance if the 0001 migration was already applied.
