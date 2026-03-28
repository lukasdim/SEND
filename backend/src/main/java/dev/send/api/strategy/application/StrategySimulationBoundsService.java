package dev.send.api.strategy.application;

import dev.send.api.marketdata.infra.persistence.StockPriceJdbcRepository;
import java.time.ZoneOffset;
import org.springframework.stereotype.Service;

@Service
public class StrategySimulationBoundsService {
  private final StockPriceJdbcRepository stockPriceJdbcRepository;

  public StrategySimulationBoundsService(StockPriceJdbcRepository stockPriceJdbcRepository) {
    this.stockPriceJdbcRepository = stockPriceJdbcRepository;
  }

  public StrategySimulationBounds getSimulationBounds() {
    return stockPriceJdbcRepository
        .findGlobalPriceCoverage()
        .map(
            coverage ->
                new StrategySimulationBounds(
                    true,
                    coverage.earliestTime().atOffset(ZoneOffset.UTC).toLocalDate().toString(),
                    coverage.latestTime().atOffset(ZoneOffset.UTC).toLocalDate().toString()))
        .orElseGet(() -> new StrategySimulationBounds(false, null, null));
  }
}
