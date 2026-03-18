package dev.send.api.domain.strategy.node;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import javax.annotation.Nullable;

import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import dev.send.api.domain.strategy.spec.NodeSpec;
import dev.send.api.domain.strategy.spec.NodeSpecSet;

/**
 * Temporary registry shell for the frontend node catalog.
 *
 * <p>This registry no longer scans Java node classes. Instead, it is prepared to
 * map future JSON-backed node specs into the catalog shape currently consumed by
 * the frontend.
 */
public final class NodeIoRegistry {
    private static final String NODE_SPECS_PATTERN = "classpath*:node-specs/**/*.json";
    private static final String NODE_SPECS_ROOT = "node-specs/";
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private NodeIoRegistry() {}

    public static NodeIoCatalog asCatalog() {
        return asCatalog(loadAllNodeSpecs());
    }

    public static NodeIoCatalog asCatalog(List<? extends NodeSpec> specs) {
        List<NodeIoDto> nodes = specs.stream()
                .map(spec -> {
                    Object rawInputs = spec.payload().get("inputs");
                    Object rawOutputs = spec.payload().get("outputs");
                    return new NodeIoDto(
                            spec.nodeType(),
                            spec.set().name(),
                            toPortDtos(rawInputs),
                            toPortDtos(rawOutputs));
                })
                .toList();
        return new NodeIoCatalog(nodes);
    }

    private static List<NodeSpec> loadAllNodeSpecs() {
        PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
        try {
            Resource[] resources = resolver.getResources(NODE_SPECS_PATTERN);
            List<NodeSpec> specs = new ArrayList<>(resources.length);
            for (Resource resource : resources) {
                if (!resource.exists() || !resource.isReadable()) {
                    continue;
                }
                specs.add(readNodeSpec(resource));
            }
            specs.sort(Comparator
                    .comparing((NodeSpec spec) -> spec.set().name())
                    .thenComparing(NodeSpec::nodeType));
            return List.copyOf(specs);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to scan node-specs resources", e);
        }
    }

    private static NodeSpec readNodeSpec(Resource resource) {
        try (InputStream inputStream = resource.getInputStream()) {
            Map<String, Object> payload = OBJECT_MAPPER.readValue(inputStream, MAP_TYPE);
            String nodeType = toStringValue(payload.get("nodeType"));
            if (nodeType.isBlank()) {
                throw new IllegalStateException("Node spec is missing nodeType: " + resource.getDescription());
            }
            return new NodeSpec(nodeType, inferSet(resource, payload), payload);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read node spec: " + resource.getDescription(), e);
        }
    }

    private static NodeSpecSet inferSet(Resource resource, Map<String, Object> payload) {
        String path = resourcePath(resource);
        int rootIndex = path.indexOf(NODE_SPECS_ROOT);
        if (rootIndex >= 0) {
            String relative = path.substring(rootIndex + NODE_SPECS_ROOT.length()).replace('\\', '/');
            int separatorIndex = relative.indexOf('/');
            if (separatorIndex > 0) {
                return toNodeSpecSet(relative.substring(0, separatorIndex), resource);
            }
        }

        Object rawSet = payload.get("set");
        if (rawSet instanceof String setName && !setName.isBlank()) {
            return toNodeSpecSet(setName, resource);
        }
        throw new IllegalStateException("Could not infer node set for resource: " + resource.getDescription());
    }

    private static NodeSpecSet toNodeSpecSet(String rawSetName, Resource resource) {
        try {
            return NodeSpecSet.valueOf(rawSetName.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException(
                    "Unsupported node set '" + rawSetName + "' in resource: " + resource.getDescription(),
                    e);
        }
    }

    private static String resourcePath(Resource resource) {
        try {
            return resource.getURL().toString();
        } catch (IOException e) {
            return resource.getDescription();
        }
    }

    private static List<PortDto> toPortDtos(@Nullable Object rawPorts) {
        if (!(rawPorts instanceof List<?> ports)) {
            return List.of();
        }

        List<PortDto> out = new ArrayList<>(ports.size());
        for (Object rawPort : ports) {
            if (!(rawPort instanceof Map<?, ?> port)) {
                continue;
            }
            Object rawIndex = port.get("index");
            Object rawName = port.get("name");
            Object rawArity = port.get("arity");
            Object rawValueType = port.get("valueType");
            out.add(new PortDto(
                    toInt(rawIndex),
                    toStringValue(rawName),
                    toStringValue(rawArity),
                    toStringValue(rawValueType),
                    toStringValue(rawValueType)));
        }
        return List.copyOf(out);
    }

    private static int toInt(@Nullable Object raw) {
        if (raw instanceof Number number) {
            return number.intValue();
        }
        return -1;
    }

    private static String toStringValue(@Nullable Object raw) {
        return raw instanceof String value ? value : "";
    }

    public record NodeIoCatalog(List<NodeIoDto> nodes) {}

    public record NodeIoDto(
            String nodeType,
            String nodeClass,
            List<PortDto> inputs,
            List<PortDto> outputs) {}

    public record PortDto(
            int index,
            String name,
            String arity,
            String valueType,
            String valueTypeClass) {}
}
