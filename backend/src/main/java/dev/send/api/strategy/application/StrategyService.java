package dev.send.api.strategy.application;

import dev.send.api.strategy.domain.StrategyDocument;
import dev.send.api.strategy.domain.StrategyRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class StrategyService {
  private final StrategyRepository strategyRepository;
  private final StrategyGraphValidator strategyGraphValidator;

  public StrategyService(
      StrategyRepository strategyRepository, StrategyGraphValidator strategyGraphValidator) {
    this.strategyRepository = strategyRepository;
    this.strategyGraphValidator = strategyGraphValidator;
  }

  public List<StrategyDocument> findAll() {
    return strategyRepository.findAll();
  }

  public Optional<StrategyDocument> findById(String id) {
    return strategyRepository.findById(id);
  }

  public StrategyDocument save(StrategyDocument strategyDocument) {
    strategyGraphValidator.validate(strategyDocument);
    return strategyRepository.save(strategyDocument);
  }
}
