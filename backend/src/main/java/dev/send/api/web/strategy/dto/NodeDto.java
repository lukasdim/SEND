package dev.send.api.web.strategy.dto;

import java.util.Map;

public record NodeDto(
        String id,
        String type,
        Position position,
        Map<String, Object> data
) {

    public record Position(
            double x,
            double y
    ) {}
}