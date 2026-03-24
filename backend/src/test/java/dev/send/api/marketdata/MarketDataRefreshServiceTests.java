package dev.send.api.marketdata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.mock;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import dev.send.api.marketdata.application.FundamentalsDataProvider;
import dev.send.api.marketdata.application.MarketDataProperties;
import dev.send.api.marketdata.application.MarketDataRefreshResult;
import dev.send.api.marketdata.application.MarketDataRefreshService;
import dev.send.api.marketdata.application.PriceDataProvider;
import dev.send.api.marketdata.domain.DailyStockPrice;
import dev.send.api.marketdata.domain.StockFundamentals;
import dev.send.api.marketdata.infra.persistence.StockFundamentalsEntity;
import dev.send.api.marketdata.infra.persistence.StockFundamentalsRepository;
import dev.send.api.marketdata.infra.persistence.StockPriceJdbcRepository;
import dev.send.api.marketdata.infra.persistence.TrackedTickerJdbcRepository;

class MarketDataRefreshServiceTests {
    private final StockPriceJdbcRepository stockPriceJdbcRepository = mock(StockPriceJdbcRepository.class);

    private final StockFundamentalsRepository stockFundamentalsRepository =
            mock(StockFundamentalsRepository.class);

    private final TrackedTickerJdbcRepository trackedTickerJdbcRepository =
            mock(TrackedTickerJdbcRepository.class);

    @Test
    void refreshTrackedPricesNormalizesSymbolsAndUpsertsAvailableRows() {
        PriceDataProvider priceDataProvider = symbol -> Optional.of(new DailyStockPrice(
                symbol,
                Instant.parse("2026-03-24T00:00:00Z"),
                1.0,
                2.0,
                0.5,
                1.5,
                100L));
        when(trackedTickerJdbcRepository.findEnabledSymbols()).thenReturn(List.of("AAPL", "SPY"));
        when(stockPriceJdbcRepository.upsert(any(DailyStockPrice.class))).thenReturn(1);

        MarketDataRefreshService service = new MarketDataRefreshService(
                new MarketDataProperties(),
                stockPriceJdbcRepository,
                stockFundamentalsRepository,
                trackedTickerJdbcRepository,
                Optional.of(priceDataProvider),
                Optional.empty());

        MarketDataRefreshResult result = service.refreshTrackedPrices();

        assertEquals("prices", result.dataset());
        assertEquals("tracked", result.scope());
        assertEquals(List.of("AAPL", "SPY"), result.requestedSymbols());
        assertEquals(2, result.recordsWritten());
        verify(stockPriceJdbcRepository).upsert(argThat(price -> price != null && price.symbol().equals("AAPL")));
        verify(stockPriceJdbcRepository).upsert(argThat(price -> price != null && price.symbol().equals("SPY")));
    }

    @Test
    void refreshFundamentalsPersistsReturnedFundamentals() {
        FundamentalsDataProvider fundamentalsDataProvider = symbol -> Optional.of(new StockFundamentals(
                symbol,
                6.12,
                18.2,
                1.04,
                LocalDate.parse("2026-03-20"),
                Map.of("dividend_yield", 1.7),
                Instant.parse("2026-03-24T10:15:30Z")));

        MarketDataRefreshService service = new MarketDataRefreshService(
                new MarketDataProperties(),
                stockPriceJdbcRepository,
                stockFundamentalsRepository,
                trackedTickerJdbcRepository,
                Optional.empty(),
                Optional.of(fundamentalsDataProvider));

        MarketDataRefreshResult result = service.refreshFundamentals(" msft ");

        assertEquals("fundamentals", result.dataset());
        assertEquals("single", result.scope());
        assertEquals(List.of("MSFT"), result.requestedSymbols());
        assertEquals(1, result.recordsWritten());
        verify(stockFundamentalsRepository)
                .save(argThat(entityMatches("MSFT", 6.12, 18.2, 1.04, "dividend_yield", 1.7)));
    }

    @Test
    void throwsWhenPriceProviderIsUnavailable() {
        MarketDataRefreshService service = new MarketDataRefreshService(
                new MarketDataProperties(),
                stockPriceJdbcRepository,
                stockFundamentalsRepository,
                trackedTickerJdbcRepository,
                Optional.empty(),
                Optional.empty());

        when(trackedTickerJdbcRepository.findEnabledSymbols()).thenReturn(List.of("AAPL"));

        assertThrows(IllegalStateException.class, service::refreshTrackedPrices);
        verifyNoInteractions(stockPriceJdbcRepository);
    }

    private static org.mockito.ArgumentMatcher<StockFundamentalsEntity> entityMatches(
            String symbol,
            double eps,
            double peRatio,
            double beta,
            String extraMetricKey,
            double extraMetricValue) {
        return entity -> entity != null
                && entity.getSymbol().equals(symbol)
                && Double.valueOf(eps).equals(entity.getEps())
                && Double.valueOf(peRatio).equals(entity.getPeRatio())
                && Double.valueOf(beta).equals(entity.getBeta())
                && Double.valueOf(extraMetricValue).equals(entity.getExtraMetrics().get(extraMetricKey));
    }
}
