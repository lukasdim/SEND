package dev.send.api.web.strategy;

import org.springframework.web.bind.annotation.*;
import javax.annotation.Nullable;

import dev.send.api.web.strategy.dto.GraphDto;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/strategies")
public class StrategyController {

    private final Map<String, GraphDto> store = new ConcurrentHashMap<>();

    @GetMapping
    public Collection<GraphDto> getAll() {
        return store.values();
    }

    @PostMapping
    public GraphDto create(@RequestBody GraphDto strategy) {
        store.put(strategy.id(), strategy);
        return strategy;
    }

    @GetMapping("/{id}")
    @Nullable
    public GraphDto getStrategy(@PathVariable String id) {
        return store.get(id);
    }
}
