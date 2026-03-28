package dev.send.api.marketdata;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.send.api.marketdata.api.MarketDataAdminController;
import dev.send.api.marketdata.application.MarketDataRefreshResult;
import dev.send.api.marketdata.application.MarketDataRefreshService;
import dev.send.api.marketdata.infra.persistence.TrackedTickerJdbcRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(MarketDataAdminController.class)
class MarketDataAdminControllerTests {
  @Autowired private MockMvc mockMvc;

  @MockBean private MarketDataRefreshService marketDataRefreshService;

  @Test
  void listsTrackedTickers() throws Exception {
    when(marketDataRefreshService.listTrackedTickers())
        .thenReturn(
            List.of(
                new TrackedTickerJdbcRepository.TrackedTicker("AAPL", true),
                new TrackedTickerJdbcRepository.TrackedTicker("MSFT", false)));

    mockMvc
        .perform(get("/api/admin/market-data/tickers"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].symbol").value("AAPL"))
        .andExpect(jsonPath("$[1].enabled").value(false));
  }

  @Test
  void addsTrackedTicker() throws Exception {
    when(marketDataRefreshService.addTrackedTicker("AAPL"))
        .thenReturn(List.of(new TrackedTickerJdbcRepository.TrackedTicker("AAPL", true)));

    mockMvc
        .perform(post("/api/admin/market-data/tickers?symbol=AAPL"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].symbol").value("AAPL"));
  }

  @Test
  void refreshesTrackedPricesWhenSymbolIsOmitted() throws Exception {
    when(marketDataRefreshService.refreshTrackedPrices(4))
        .thenReturn(new MarketDataRefreshResult("prices", "tracked", List.of("AAPL", "SPY"), 2));

    mockMvc
        .perform(post("/api/admin/market-data/prices/refresh?length=4"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.dataset").value("prices"))
        .andExpect(jsonPath("$.scope").value("tracked"))
        .andExpect(jsonPath("$.requestedSymbols[0]").value("AAPL"))
        .andExpect(jsonPath("$.recordsWritten").value(2));
  }

  @Test
  void refreshesSingleFundamentalsSymbolWhenProvided() throws Exception {
    when(marketDataRefreshService.refreshFundamentals("AAPL"))
        .thenReturn(new MarketDataRefreshResult("fundamentals", "single", List.of("AAPL"), 1));

    mockMvc
        .perform(post("/api/admin/market-data/fundamentals/refresh?symbol=AAPL"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.dataset").value("fundamentals"))
        .andExpect(jsonPath("$.requestedSymbols[0]").value("AAPL"))
        .andExpect(jsonPath("$.recordsWritten").value(1));
  }

  @Test
  void refreshesSinglePriceSymbolWithLengthAndPeriod() throws Exception {
    when(marketDataRefreshService.refreshPrice("AAPL", 3))
        .thenReturn(new MarketDataRefreshResult("prices", "single", List.of("AAPL"), 3));

    mockMvc
        .perform(post("/api/admin/market-data/prices/refresh?symbol=AAPL&length=3"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.requestedSymbols[0]").value("AAPL"))
        .andExpect(jsonPath("$.recordsWritten").value(3));
  }

  @Test
  void returnsServiceUnavailableWhenProviderIsMissing() throws Exception {
    when(marketDataRefreshService.refreshTrackedPrices(1))
        .thenThrow(new IllegalStateException("No price data provider is configured."));

    mockMvc
        .perform(post("/api/admin/market-data/prices/refresh"))
        .andExpect(status().isServiceUnavailable());
  }

  @Test
  void returnsBadRequestForInvalidSymbol() throws Exception {
    when(marketDataRefreshService.refreshPrice(anyString(), anyInt()))
        .thenThrow(new IllegalArgumentException("Symbol must not be blank."));

    mockMvc
        .perform(post("/api/admin/market-data/prices/refresh?symbol=%20%20%20"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void deletesTrackedTicker() throws Exception {
    when(marketDataRefreshService.deleteTrackedTicker("AAPL")).thenReturn(List.of());

    mockMvc.perform(delete("/api/admin/market-data/tickers/AAPL")).andExpect(status().isOk());
  }
}
