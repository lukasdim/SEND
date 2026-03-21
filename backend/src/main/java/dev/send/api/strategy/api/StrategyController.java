package dev.send.api.strategy.api;

import java.util.Collection;
import java.util.List;

import javax.annotation.Nullable;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import dev.send.api.catalog.api.dto.NodeIoCatalogDto;
import dev.send.api.catalog.application.NodeCatalogService;
import dev.send.api.strategy.api.dto.StrategyDocumentDto;
import dev.send.api.strategy.application.StrategyDocumentMapper;
import dev.send.api.strategy.application.StrategyService;
import dev.send.api.strategy.application.StrategyValidationException;
import dev.send.api.worker.application.StrategyExecutionException;
import dev.send.api.worker.application.StrategyExecutionService;

import com.fasterxml.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/strategies")
public class StrategyController {
    private final StrategyService strategyService;
    private final StrategyDocumentMapper strategyDocumentMapper;
    private final NodeCatalogService nodeCatalogService;
    private final StrategyExecutionService strategyExecutionService;

    public StrategyController(
            StrategyService strategyService,
            StrategyDocumentMapper strategyDocumentMapper,
            NodeCatalogService nodeCatalogService,
            StrategyExecutionService strategyExecutionService) {
        this.strategyService = strategyService;
        this.strategyDocumentMapper = strategyDocumentMapper;
        this.nodeCatalogService = nodeCatalogService;
        this.strategyExecutionService = strategyExecutionService;
    }

    @GetMapping
    public Collection<StrategyDocumentDto> getAll() {
        return strategyService.findAll().stream()
                .map(strategyDocumentMapper::toDto)
                .toList();
    }

    @PostMapping
    public StrategyDocumentDto create(@RequestBody StrategyDocumentDto strategyDocumentDto) {
        return strategyDocumentMapper.toDto(
                strategyService.save(strategyDocumentMapper.toDomain(strategyDocumentDto)));
    }

    @PostMapping("/test")
    public JsonNode test(@RequestBody StrategyDocumentDto strategyDocumentDto) {
        return strategyExecutionService.executeGraphResults(strategyDocumentMapper.toDomain(strategyDocumentDto));
    }

    @GetMapping("/{id}")
    @Nullable
    public StrategyDocumentDto getStrategy(@PathVariable String id) {
        return strategyService.findById(id)
                .map(strategyDocumentMapper::toDto)
                .orElse(null);
    }

    @GetMapping("/node-io")
    public NodeIoCatalogDto getNodeIoCatalog() {
        return nodeCatalogService.getNodeIoCatalog();
    }

    @ExceptionHandler(StrategyValidationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiErrorDto handleValidationError(StrategyValidationException exception) {
        String message = exception.getMessage();
        return new ApiErrorDto(
                "strategy_validation_failed",
                message == null ? "Strategy validation failed." : message,
                List.of());
    }

    @ExceptionHandler(StrategyExecutionException.class)
    public ResponseEntity<ApiErrorDto> handleExecutionError(StrategyExecutionException exception) {
        String message = exception.getMessage();
        ApiErrorDto error = new ApiErrorDto(
                exception.code(),
                message == null ? "Strategy execution failed." : message,
                exception.details());
        return ResponseEntity.status(exception.httpStatus()).body(error);
    }
}
