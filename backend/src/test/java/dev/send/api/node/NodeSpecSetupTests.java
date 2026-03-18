package dev.send.api.node;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import dev.send.api.app.strategy.catalog.NodeCatalogService;
import dev.send.api.app.strategy.catalog.NodeSpecCatalogLoader;
import dev.send.api.app.strategy.catalog.NodeSpecSetConfig;
import dev.send.api.domain.strategy.node.NodeIoRegistry;
import dev.send.api.domain.strategy.spec.NodeSpec;
import dev.send.api.domain.strategy.spec.NodeSpecSet;

class NodeSpecSetupTests {

    @Test
    void setBuilderRegistersPrimitiveFetchAndDerivedSets() {
        List<NodeSpecSetConfig> configs = new NodeSpecSetConfig.Builder()
                .addSet(NodeSpecSet.PRIMITIVE, "node-specs/primitive")
                .addSet(NodeSpecSet.FETCH, "node-specs/fetch")
                .addSet(NodeSpecSet.DERIVED, "node-specs/derived")
                .build();

        assertEquals(3, configs.size());
        assertEquals(NodeSpecSet.PRIMITIVE, configs.get(0).set());
        assertEquals("node-specs/fetch", configs.get(1).resourceSubdirectory());
        assertEquals(NodeSpecSet.DERIVED, configs.get(2).set());
    }

    @Test
    void loaderUsesRegisteredSetConfigInsteadOfHardcodedFileNames() {
        NodeSpecCatalogLoader loader = new NodeSpecCatalogLoader();

        assertIterableEquals(
                List.of(NodeSpecSet.PRIMITIVE, NodeSpecSet.FETCH, NodeSpecSet.DERIVED),
                loader.registeredSets().stream().map(NodeSpecSetConfig::set).toList());
        assertIterableEquals(
                List.of("node-specs/primitive", "node-specs/fetch", "node-specs/derived"),
                loader.registeredSets().stream().map(NodeSpecSetConfig::resourceSubdirectory).toList());
    }

    @Test
    void registryRemainsSingleCatalogEntryPoint() {
        NodeIoRegistry.NodeIoCatalog emptyCatalog = NodeIoRegistry.asCatalog();
        NodeIoRegistry.NodeIoCatalog mappedCatalog = NodeIoRegistry.asCatalog(List.of(sampleNativeSpec()));

        assertTrue(emptyCatalog.nodes().stream().anyMatch(node -> node.nodeType().equals("add")));
        assertEquals(1, mappedCatalog.nodes().size());
        assertEquals("add", mappedCatalog.nodes().getFirst().nodeType());
        assertEquals("PRIMITIVE", mappedCatalog.nodes().getFirst().nodeClass());
        assertEquals("NumVal", mappedCatalog.nodes().getFirst().outputs().getFirst().valueTypeClass());
    }

    @Test
    void registryScansNodeSpecResourcesAcrossSets() {
        NodeIoRegistry.NodeIoCatalog catalog = NodeIoRegistry.asCatalog();

        assertTrue(catalog.nodes().stream().anyMatch(node -> node.nodeType().equals("fetch_price")));
        assertTrue(catalog.nodes().stream().anyMatch(node -> node.nodeType().equals("average_2")));
        assertTrue(catalog.nodes().stream().anyMatch(node -> node.nodeClass().equals("FETCH")));
        assertTrue(catalog.nodes().stream().anyMatch(node -> node.nodeClass().equals("DERIVED")));
    }

    @Test
    void unifiedNodeSpecRepresentsNativeAndDerivedShapes() {
        NodeSpec nativeSpec = sampleNativeSpec();
        NodeSpec derivedSpec = new NodeSpec(
                "average_2",
                NodeSpecSet.DERIVED,
                Map.of(
                        "displayName", "Average Of Two",
                        "derivedGraph", Map.of("nodes", List.of(), "edges", List.of())));

        assertEquals(NodeSpecSet.PRIMITIVE, nativeSpec.set());
        assertEquals("add", nativeSpec.payload().get("executorKey"));
        assertEquals(null, nativeSpec.payload().get("derivedGraph"));
        assertEquals(NodeSpecSet.DERIVED, derivedSpec.set());
        assertEquals(null, derivedSpec.payload().get("executorKey"));
        assertTrue(derivedSpec.payload().get("derivedGraph") != null);
        assertEquals(3, new NodeCatalogService().registeredSets().size());
    }

    private static NodeSpec sampleNativeSpec() {
        return new NodeSpec(
                "add",
                NodeSpecSet.PRIMITIVE,
                Map.of(
                        "displayName", "Add",
                        "description", "Adds two numbers.",
                        "inputs", List.of(
                                Map.of("index", 0, "name", "a", "arity", "ONE", "valueType", "NumVal"),
                                Map.of("index", 1, "name", "b", "arity", "ONE", "valueType", "NumVal")),
                        "outputs", List.of(
                                Map.of("index", 0, "name", "sum", "arity", "ONE", "valueType", "NumVal")),
                        "dataFields", List.of(
                                Map.of("name", "precision", "valueType", "NumVal", "required", false, "defaultValue", 2)),
                        "executorKey", "add"));
    }
}
