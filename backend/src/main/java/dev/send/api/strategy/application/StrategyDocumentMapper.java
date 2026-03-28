package dev.send.api.strategy.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.send.api.strategy.api.dto.GraphEdgeDto;
import dev.send.api.strategy.api.dto.GraphNodeDto;
import dev.send.api.strategy.api.dto.NodePositionDto;
import dev.send.api.strategy.api.dto.StrategyDocumentDto;
import dev.send.api.strategy.domain.GraphEdge;
import dev.send.api.strategy.domain.GraphNode;
import dev.send.api.strategy.domain.NodePosition;
import dev.send.api.strategy.domain.StrategyDocument;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class StrategyDocumentMapper {
  private final ObjectMapper objectMapper;

  public StrategyDocumentMapper(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public StrategyDocument toDomain(StrategyDocumentDto dto) {
    if (dto.nodes() == null) {
      throw new StrategyValidationException("Strategy nodes are required.");
    }
    if (dto.edges() == null) {
      throw new StrategyValidationException("Strategy edges are required.");
    }

    List<GraphNode> nodes =
        dto.nodes().stream()
            .map(
                node ->
                    new GraphNode(
                        node.id(),
                        node.type(),
                        toDomain(node.position()),
                        normalizeData(node.data())))
            .toList();
    List<GraphEdge> edges =
        dto.edges().stream()
            .map(
                edge ->
                    new GraphEdge(
                        edge.id(),
                        edge.source(),
                        edge.target(),
                        edge.sourceHandle(),
                        edge.targetHandle(),
                        edge.sourcePort(),
                        edge.targetPort()))
            .toList();
    return new StrategyDocument(dto.id(), nodes, edges);
  }

  public StrategyDocumentDto toDto(StrategyDocument strategyDocument) {
    return new StrategyDocumentDto(
        strategyDocument.id(),
        strategyDocument.nodes().stream()
            .map(
                node ->
                    new GraphNodeDto(node.id(), node.type(), toDto(node.position()), node.data()))
            .toList(),
        strategyDocument.edges().stream()
            .map(
                edge ->
                    new GraphEdgeDto(
                        edge.id(),
                        edge.source(),
                        edge.target(),
                        edge.sourceHandle(),
                        edge.targetHandle(),
                        edge.sourcePort(),
                        edge.targetPort()))
            .toList());
  }

  private NodePosition toDomain(NodePositionDto position) {
    if (position == null) {
      throw new StrategyValidationException("Node position is required.");
    }
    return new NodePosition(position.x(), position.y());
  }

  private NodePositionDto toDto(NodePosition position) {
    return new NodePositionDto(position.x(), position.y());
  }

  private JsonNode normalizeData(JsonNode data) {
    if (data != null && data.isObject()) {
      return data.deepCopy();
    }
    return objectMapper.createObjectNode();
  }
}
