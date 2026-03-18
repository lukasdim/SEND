package dev.send.api.app.strategy.catalog;

import java.util.ArrayList;
import java.util.List;

import dev.send.api.domain.strategy.spec.NodeSpecSet;

/**
 * Declares one registered node-spec set and the resource directory it will
 * eventually scan.
 */
public record NodeSpecSetConfig(
        NodeSpecSet set,
        String resourceSubdirectory) {

    /**
     * Builder for declaring the sets that the loader will eventually scan.
     *
     * <p>This is intentionally configuration-only in the current phase.
     */
    public static final class Builder {
        private final List<NodeSpecSetConfig> configs = new ArrayList<>();

        public Builder addSet(NodeSpecSet set, String resourceSubdirectory) {
            configs.add(new NodeSpecSetConfig(set, resourceSubdirectory));
            return this;
        }

        public List<NodeSpecSetConfig> build() {
            return List.copyOf(configs);
        }
    }
}
