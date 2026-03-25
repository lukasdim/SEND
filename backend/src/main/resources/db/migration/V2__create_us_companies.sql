CREATE TABLE IF NOT EXISTS us_companies (
  ticker                  TEXT PRIMARY KEY,
  company_name            TEXT,
  industry_id             BIGINT,
  isin                    TEXT,
  fiscal_year_end_month   INTEGER,
  number_employees        BIGINT,
  business_summary        TEXT,
  market                  TEXT,
  cik                     BIGINT,
  main_currency           TEXT,
  reserved_01             TEXT,
  reserved_02             TEXT,
  reserved_03             TEXT,
  reserved_04             TEXT,
  reserved_05             TEXT,
  reserved_06             TEXT,
  reserved_07             TEXT,
  reserved_08             TEXT,
  reserved_09             TEXT,
  reserved_10             TEXT,
  reserved_11             TEXT,
  reserved_12             TEXT,
  reserved_13             TEXT,
  reserved_14             TEXT,
  reserved_15             TEXT,
  reserved_16             TEXT,
  reserved_17             TEXT,
  reserved_18             TEXT,
  reserved_19             TEXT,
  reserved_20             TEXT,
  reserved_21             TEXT,
  reserved_22             TEXT,
  reserved_23             TEXT,
  reserved_24             TEXT,
  reserved_25             TEXT,
  reserved_26             TEXT,
  reserved_27             TEXT,
  reserved_28             TEXT,
  reserved_29             TEXT,
  reserved_30             TEXT,
  reserved_31             TEXT,
  reserved_32             TEXT,
  reserved_33             TEXT,
  reserved_34             TEXT,
  reserved_35             TEXT,
  reserved_36             TEXT,
  reserved_37             TEXT,
  reserved_38             TEXT,
  reserved_39             TEXT,
  reserved_40             TEXT,
  indsu_1                 TEXT,
  indsu_2                 TEXT
);

CREATE INDEX IF NOT EXISTS us_companies_market_idx
  ON us_companies (market);

CREATE INDEX IF NOT EXISTS us_companies_industry_id_idx
  ON us_companies (industry_id);

CREATE INDEX IF NOT EXISTS us_companies_cik_idx
  ON us_companies (cik);
