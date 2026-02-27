package dev.send.api.web.strategy.dto;

import java.util.List;

public record GraphDto(
        String id,
        List<NodeDto> nodes,
        List<EdgeDto> edges
) {}