CREATE TABLE IF NOT EXISTS stock_fundamentals (
  symbol        TEXT              PRIMARY KEY,
  eps           DOUBLE PRECISION,
  pe_ratio      DOUBLE PRECISION,
  beta          DOUBLE PRECISION,
  as_of_date    DATE,
  extra_metrics JSONB             NOT NULL DEFAULT '{}'::jsonb,
  refreshed_at  TIMESTAMPTZ       NOT NULL
);

CREATE INDEX IF NOT EXISTS stock_fundamentals_extra_metrics_gin_idx
  ON stock_fundamentals
  USING GIN (extra_metrics);

CREATE TABLE IF NOT EXISTS tracked_tickers (
  symbol      TEXT        PRIMARY KEY,
  enabled     BOOLEAN     NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL
);
