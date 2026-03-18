package dev.send.api.infra.ocaml;

/**
 * Placeholder client for communicating with the OCaml worker process.
 *
 * <p>Future responsibility:
 * manage the worker lifecycle and exchange correlated JSON messages over
 * stdin/stdout.
 *
 * <p>This should eventually collaborate with:
 * StrategyExecutionService,
 * stdio protocol records,
 * and process management utilities.
 *
 * <p>This is bridge code between Java and OCaml.
 */
public class OcamlWorkerClient {}
