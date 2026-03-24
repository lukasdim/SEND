CREATE TABLE IF NOT EXISTS tracked_tickers (
  symbol      TEXT        PRIMARY KEY,
  enabled     BOOLEAN     NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL
);
