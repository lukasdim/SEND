package dev.send.api.marketdata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import dev.send.api.marketdata.domain.DailyStockPrice;
import dev.send.api.marketdata.infra.persistence.StockPriceJdbcRepository;
import static org.mockito.Mockito.mock;

class StockPriceJdbcRepositoryTests {
    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);

    @Test
    void upsertUsesPostgresConflictUpdateSql() {
        Instant timestamp = Instant.parse("2026-03-24T00:00:00Z");
        DailyStockPrice stockPrice = new DailyStockPrice("AAPL", timestamp, 1.0, 2.0, 0.5, 1.5, 100L);
        when(jdbcTemplate.update(
                        eq(StockPriceJdbcRepository.UPSERT_SQL),
                        eq("AAPL"),
                        any(Timestamp.class),
                        eq(1.0),
                        eq(2.0),
                        eq(0.5),
                        eq(1.5),
                        eq(100L)))
                .thenReturn(1);

        StockPriceJdbcRepository repository = new StockPriceJdbcRepository(jdbcTemplate);

        int updatedRows = repository.upsert(stockPrice);

        assertEquals(1, updatedRows);
        verify(jdbcTemplate).update(
                eq(StockPriceJdbcRepository.UPSERT_SQL),
                eq("AAPL"),
                any(Timestamp.class),
                eq(1.0),
                eq(2.0),
                eq(0.5),
                eq(1.5),
                eq(100L));
    }

    @Test
    void findsLatestTimeForSymbolAndPeriod() {
        Timestamp timestamp = Timestamp.from(Instant.parse("2026-03-24T00:00:00Z"));
        when(jdbcTemplate.queryForObject(any(String.class), eq(Timestamp.class), eq("AAPL")))
                .thenReturn(timestamp);

        StockPriceJdbcRepository repository = new StockPriceJdbcRepository(jdbcTemplate);

        Optional<Instant> latestTime = repository.findLatestTime("AAPL");

        assertEquals(Instant.parse("2026-03-24T00:00:00Z"), latestTime.orElseThrow());
    }
}
