CREATE TABLE IF NOT EXISTS stock_prices (
  time                TIMESTAMPTZ      NOT NULL,
  symbol              TEXT             NOT NULL,
  open                DOUBLE PRECISION,
  high                DOUBLE PRECISION,
  low                 DOUBLE PRECISION,
  close               DOUBLE PRECISION,
  adj_close           DOUBLE PRECISION,
  volume              BIGINT,
  dividend            DOUBLE PRECISION,
  shares_outstanding  BIGINT,
  PRIMARY KEY (symbol, time)
);

SELECT create_hypertable('stock_prices', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS stock_prices_symbol_time_desc_idx
  ON stock_prices (symbol, time DESC);

CREATE OR REPLACE VIEW us_shareprices_daily AS
SELECT
  symbol AS ticker,
  (timezone('UTC', time))::date AS price_date,
  open,
  high,
  low,
  close,
  adj_close,
  volume,
  dividend,
  shares_outstanding
FROM stock_prices;
