package dev.send.api.catalog.application;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;

import dev.send.api.catalog.api.dto.NodeIoCatalogDto;
import dev.send.api.catalog.domain.NodeSpec;

/**
 * Cached access to the shared node specification catalog.
 */
@Service
public class NodeCatalogService {
    private final List<NodeSpec> specs;
    private final Map<String, NodeSpec> specsByType;
    private final List<NodeSpecSetConfig> registeredSets;

    public NodeCatalogService(NodeSpecCatalogLoader loader) {
        this.registeredSets = loader.registeredSets();
        this.specs = loader.loadAll();
        Map<String, NodeSpec> mutableIndex = new LinkedHashMap<>();
        for (NodeSpec spec : specs) {
            mutableIndex.put(spec.nodeType(), spec);
        }
        this.specsByType = Map.copyOf(mutableIndex);
    }

    public List<NodeSpecSetConfig> registeredSets() {
        return registeredSets;
    }

    public List<NodeSpec> allSpecs() {
        return specs;
    }

    public Optional<NodeSpec> findSpec(String nodeType) {
        return Optional.ofNullable(specsByType.get(nodeType));
    }

    public NodeIoCatalogDto getNodeIoCatalog() {
        List<NodeIoCatalogDto.NodeIoDefinitionDto> nodes = specs.stream()
                .map(spec -> new NodeIoCatalogDto.NodeIoDefinitionDto(
                        spec.nodeType(),
                        spec.set().name(),
                        toPorts(spec.payload().path("inputs")),
                        toPorts(spec.payload().path("outputs")),
                        toDataFields(spec.payload().path("dataFields"))))
                .toList();
        return new NodeIoCatalogDto(nodes);
    }

    public List<JsonNode> inputPorts(String nodeType) {
        return portNodes(nodeType, "inputs");
    }

    public List<JsonNode> outputPorts(String nodeType) {
        return portNodes(nodeType, "outputs");
    }

    public JsonNode dataFields(String nodeType) {
        return findSpec(nodeType)
                .map(spec -> spec.payload().path("dataFields"))
                .orElseThrow(() -> new IllegalArgumentException("Unknown node type: " + nodeType));
    }

    private List<JsonNode> portNodes(String nodeType, String fieldName) {
        JsonNode ports = findSpec(nodeType)
                .map(spec -> spec.payload().path(fieldName))
                .orElseThrow(() -> new IllegalArgumentException("Unknown node type: " + nodeType));

        if (!ports.isArray()) {
            return List.of();
        }

        List<JsonNode> out = new ArrayList<>();
        for (JsonNode port : ports) {
            out.add(port);
        }
        return List.copyOf(out);
    }

    private List<NodeIoCatalogDto.NodeIoPortDto> toPorts(JsonNode rawPorts) {
        if (!rawPorts.isArray()) {
            return List.of();
        }

        List<NodeIoCatalogDto.NodeIoPortDto> ports = new ArrayList<>();
        for (JsonNode port : rawPorts) {
            ports.add(new NodeIoCatalogDto.NodeIoPortDto(
                    port.path("index").asInt(-1),
                    port.path("name").asText(""),
                    port.path("arity").asText(""),
                    port.path("valueType").asText(""),
                    port.path("valueType").asText("")));
        }
        return List.copyOf(ports);
    }

    private List<NodeIoCatalogDto.NodeIoDataFieldDto> toDataFields(JsonNode rawDataFields) {
        if (!rawDataFields.isArray()) {
            return List.of();
        }

        List<NodeIoCatalogDto.NodeIoDataFieldDto> dataFields = new ArrayList<>();
        for (JsonNode dataField : rawDataFields) {
            JsonNode defaultValue = dataField.get("defaultValue");
            dataFields.add(new NodeIoCatalogDto.NodeIoDataFieldDto(
                    dataField.path("name").asText(""),
                    dataField.path("valueType").asText(""),
                    dataField.path("valueType").asText(""),
                    dataField.path("required").asBoolean(false),
                    defaultValue == null ? null : defaultValue.deepCopy()));
        }
        return List.copyOf(dataFields);
    }
}
