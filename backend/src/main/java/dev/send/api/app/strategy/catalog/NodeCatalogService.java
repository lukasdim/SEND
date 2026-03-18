package dev.send.api.app.strategy.catalog;

import java.util.List;

import dev.send.api.domain.strategy.spec.NodeSpec;

/**
 * Placeholder access layer for the node catalog.
 *
 * <p>This currently exposes the loader wiring and future catalog lookup boundary
 * without implementing filesystem scanning or caching behavior.
 */
public class NodeCatalogService {
    private final NodeSpecCatalogLoader loader;

    public NodeCatalogService() {
        this(new NodeSpecCatalogLoader());
    }

    public NodeCatalogService(NodeSpecCatalogLoader loader) {
        this.loader = loader;
    }

    public NodeSpecCatalogLoader loader() {
        return loader;
    }

    public List<NodeSpecSetConfig> registeredSets() {
        return loader.registeredSets();
    }

    public List<NodeSpec> allSpecs() {
        return loader.loadAll();
    }
}
