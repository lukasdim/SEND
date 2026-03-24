DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_prices_pkey'
  ) THEN
    ALTER TABLE stock_prices
      ADD CONSTRAINT stock_prices_pkey PRIMARY KEY (symbol, time);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS stock_prices_symbol_time_desc_idx
  ON stock_prices (symbol, time DESC);
