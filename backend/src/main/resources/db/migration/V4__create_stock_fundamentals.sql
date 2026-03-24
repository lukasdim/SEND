CREATE TABLE IF NOT EXISTS stock_fundamentals (
  symbol        TEXT              PRIMARY KEY,
  eps           DOUBLE PRECISION,
  pe_ratio      DOUBLE PRECISION,
  beta          DOUBLE PRECISION,
  as_of_date    DATE,
  refreshed_at  TIMESTAMPTZ       NOT NULL
);
