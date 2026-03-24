ALTER TABLE stock_fundamentals
  ADD COLUMN IF NOT EXISTS extra_metrics JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS stock_fundamentals_extra_metrics_gin_idx
  ON stock_fundamentals
  USING GIN (extra_metrics);
