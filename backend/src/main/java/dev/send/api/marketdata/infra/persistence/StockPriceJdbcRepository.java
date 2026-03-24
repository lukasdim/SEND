package dev.send.api.marketdata.infra.persistence;

import java.sql.Timestamp;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import dev.send.api.marketdata.domain.DailyStockPrice;

@Repository
public class StockPriceJdbcRepository {
    public static final String UPSERT_SQL = """
            INSERT INTO stock_prices (symbol, time, open, high, low, close, volume)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (symbol, time) DO UPDATE
            SET open = EXCLUDED.open,
                high = EXCLUDED.high,
                low = EXCLUDED.low,
                close = EXCLUDED.close,
                volume = EXCLUDED.volume
            """;

    private final JdbcTemplate jdbcTemplate;

    public StockPriceJdbcRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public int upsert(DailyStockPrice stockPrice) {
        return jdbcTemplate.update(
                UPSERT_SQL,
                stockPrice.symbol(),
                Timestamp.from(stockPrice.time()),
                stockPrice.open(),
                stockPrice.high(),
                stockPrice.low(),
                stockPrice.close(),
                stockPrice.volume());
    }
}
