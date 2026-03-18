package dev.send.api.app.strategy.execution;

/**
 * Placeholder orchestration service for graph execution.
 *
 * <p>Future responsibility:
 * accept validated graph requests from the Java application layer and dispatch them
 * to the OCaml engine through the bridge layer.
 *
 * <p>This should eventually collaborate with:
 * graph validation,
 * catalog/spec lookup,
 * and infra.ocaml worker management.
 *
 * <p>This is request-time orchestration code. Java owns request handling, while
 * OCaml owns graph execution.
 */
public class StrategyExecutionService {}
