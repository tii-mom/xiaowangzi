PRAGMA foreign_keys = ON;

CREATE UNIQUE INDEX IF NOT EXISTS idx_token_ledger_bufpay_purchase_once
ON token_ledger(source, source_id, type)
WHERE source = 'bufpay' AND type = 'purchase';

-- NOTE: payment_orders.status CHECK constraint in 0001_init.sql must include 'processing'.
-- SQLite does not support ALTER TABLE to modify CHECK constraints.
-- For fresh D1 instances, 0001_init.sql has been updated to include 'processing'.
-- For existing instances, execute:
--   ALTER TABLE payment_orders RENAME TO payment_orders_old;
--   CREATE TABLE payment_orders (... CHECK (status IN ('pending','processing','paid','expired','failed','refunded')) ...);
--   INSERT INTO payment_orders SELECT * FROM payment_orders_old;
--   DROP TABLE payment_orders_old;
-- Or simply re-run 0001_init.sql to recreate the table.
