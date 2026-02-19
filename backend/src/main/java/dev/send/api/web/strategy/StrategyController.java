package dev.send.api.web.strategy;

import org.springframework.web.bind.annotation.*;

import dev.send.api.web.strategy.dto.GraphDto;

import java.util.*;

@RestController
@RequestMapping("/api/strategies")
public class StrategyController {

    private final Map<String, GraphDto> store = new HashMap<>();

    @GetMapping
    public Collection<GraphDto> getAll() {
        return store.values();
    }

    @PostMapping
    public GraphDto create(@RequestBody GraphDto strategy) {
        store.put(strategy.id(), strategy);
        return strategy;
    }
}
