package dev.send.api.strategy.api.dto;

import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;

public record StrategySimulationResultDto(
        JsonNode summary,
        JsonNode portfolio,
        JsonNode finalNodeValues,
        List<JsonNode> trace,
        List<String> warnings) {}
