package dev.send.api.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;

import dev.send.api.catalog.api.dto.NodeIoCatalogDto;
import dev.send.api.catalog.application.NodeCatalogService;
import dev.send.api.catalog.application.NodeSpecCatalogLoader;
import dev.send.api.catalog.application.NodeSpecSetConfig;
import dev.send.api.catalog.domain.NodeSpecSet;

class NodeCatalogServiceTests {
    private final ObjectMapper objectMapper = new ObjectMapper();

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
        NodeSpecCatalogLoader loader = new NodeSpecCatalogLoader(objectMapper);

        assertIterableEquals(
                List.of(NodeSpecSet.PRIMITIVE, NodeSpecSet.FETCH, NodeSpecSet.DERIVED),
                loader.registeredSets().stream().map(NodeSpecSetConfig::set).toList());
        assertIterableEquals(
                List.of("node-specs/primitive", "node-specs/fetch", "node-specs/derived"),
                loader.registeredSets().stream().map(NodeSpecSetConfig::resourceSubdirectory).toList());
    }

    @Test
    void catalogLoadsNodeSpecsAcrossSetsAndProjectsNodeIoShape() {
        NodeCatalogService nodeCatalogService = new NodeCatalogService(new NodeSpecCatalogLoader(objectMapper));

        assertEquals(3, nodeCatalogService.registeredSets().size());
        assertTrue(nodeCatalogService.findSpec("add").isPresent());
        assertTrue(nodeCatalogService.findSpec("fetch_price").isPresent());
        assertTrue(nodeCatalogService.findSpec("average_2").isPresent());

        NodeIoCatalogDto catalog = nodeCatalogService.getNodeIoCatalog();
        assertTrue(catalog.nodes().stream().anyMatch(node -> node.nodeType().equals("fetch_price")));
        assertTrue(catalog.nodes().stream().anyMatch(node -> node.nodeClass().equals("FETCH")));
        assertEquals(
                "NumVal",
                catalog.nodes().stream()
                        .filter(node -> node.nodeType().equals("add"))
                        .findFirst()
                        .orElseThrow()
                        .outputs()
                        .getFirst()
                        .valueTypeClass());
        assertEquals(
                "ticker",
                catalog.nodes().stream()
                        .filter(node -> node.nodeType().equals("fetch_price"))
                        .findFirst()
                        .orElseThrow()
                        .dataFields()
                        .getFirst()
                        .name());
    }
}
