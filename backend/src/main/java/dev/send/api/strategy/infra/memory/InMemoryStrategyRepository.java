package dev.send.api.strategy.infra.memory;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Repository;

import dev.send.api.strategy.domain.StrategyDocument;
import dev.send.api.strategy.domain.StrategyRepository;

@Repository
public class InMemoryStrategyRepository implements StrategyRepository {
    private final Map<String, StrategyDocument> store = new ConcurrentHashMap<>();

    @Override
    public List<StrategyDocument> findAll() {
        return List.copyOf(store.values());
    }

    @Override
    public Optional<StrategyDocument> findById(String id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public StrategyDocument save(StrategyDocument strategyDocument) {
        store.put(strategyDocument.id(), strategyDocument);
        return strategyDocument;
    }
}
