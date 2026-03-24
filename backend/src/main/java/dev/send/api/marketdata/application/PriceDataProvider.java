package dev.send.api.marketdata.application;

import java.util.Optional;

import dev.send.api.marketdata.domain.DailyStockPrice;

public interface PriceDataProvider {
    Optional<DailyStockPrice> fetchDailyPrice(String symbol);
}
