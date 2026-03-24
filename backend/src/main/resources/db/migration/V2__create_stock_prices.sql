CREATE TABLE IF NOT EXISTS stock_prices (
  time        TIMESTAMPTZ       NOT NULL,
  symbol      TEXT              NOT NULL,
  open        DOUBLE PRECISION,
  high        DOUBLE PRECISION,
  low         DOUBLE PRECISION,
  close       DOUBLE PRECISION,
  volume      BIGINT
);

SELECT create_hypertable('stock_prices', 'time', if_not_exists => TRUE);