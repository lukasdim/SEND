package dev.send.api.marketdata.application;

import java.util.Optional;

import dev.send.api.marketdata.domain.StockFundamentals;

public interface FundamentalsDataProvider {
    Optional<StockFundamentals> fetchFundamentals(String symbol);
}
