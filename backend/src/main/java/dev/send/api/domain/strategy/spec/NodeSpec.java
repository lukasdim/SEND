package dev.send.api.domain.strategy.spec;

import java.util.Map;

/**
 * Lightweight Java-side representation of one node specification loaded from JSON.
 *
 * <p>Java intentionally keeps this model minimal. It carries a stable identifier,
 * the spec set, and the raw JSON-shaped payload needed for transport/catalog work.
 */
public record NodeSpec(
        String nodeType,
        NodeSpecSet set,
        Map<String, Object> payload) {}
