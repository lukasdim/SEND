CREATE TABLE IF NOT EXISTS stock_prices (
  time        TIMESTAMPTZ       NOT NULL,
  symbol      TEXT              NOT NULL,
  open        DOUBLE PRECISION,
  high        DOUBLE PRECISION,
  low         DOUBLE PRECISION,
  close       DOUBLE PRECISION,
  volume      BIGINT,
  PRIMARY KEY (symbol, time)
);

SELECT create_hypertable('stock_prices', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS stock_prices_symbol_time_desc_idx
  ON stock_prices (symbol, time DESC);
