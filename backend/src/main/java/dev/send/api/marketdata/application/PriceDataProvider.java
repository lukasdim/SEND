package dev.send.api.marketdata.application;

import java.time.Instant;
import java.util.List;

import dev.send.api.marketdata.domain.DailyStockPrice;

public interface PriceDataProvider {
    List<DailyStockPrice> fetchHourlyPrices(String symbol, Instant startTime, int hourCount);
}
