package dev.send.api.app.strategy.catalog;

import java.util.List;

import dev.send.api.domain.strategy.spec.NodeSpec;
import dev.send.api.domain.strategy.spec.NodeSpecSet;

/**
 * Startup-time placeholder for node-spec loading.
 *
 * <p>This class currently owns only the set registration/wiring needed for a
 * future recursive resource scan. It does not yet walk directories or parse JSON.
 */
public class NodeSpecCatalogLoader {
    private final List<NodeSpecSetConfig> registeredSets;

    public NodeSpecCatalogLoader() {
        this(new NodeSpecSetConfig.Builder()
                .addSet(NodeSpecSet.PRIMITIVE, "node-specs/primitive")
                .addSet(NodeSpecSet.FETCH, "node-specs/fetch")
                .addSet(NodeSpecSet.DERIVED, "node-specs/derived")
                .build());
    }

    public NodeSpecCatalogLoader(List<NodeSpecSetConfig> registeredSets) {
        this.registeredSets = List.copyOf(registeredSets);
    }

    public List<NodeSpecSetConfig> registeredSets() {
        return registeredSets;
    }

    public List<NodeSpec> loadAll() {
        // Resource scanning and JSON parsing will be added in a later pass.
        return List.of();
    }
}
