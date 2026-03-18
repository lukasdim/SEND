# Graph Layer

This directory defines the OCaml graph model used by the execution engine.

Responsibilities:
- represent graph nodes and explicit port-to-port edges
- carry scalar runtime values and raw node config payloads
- validate graph structure during construction
- provide deterministic traversal helpers for DAG execution

Planned module layout:
- `node_id.ml` / `node_id.mli`: stable node identifiers plus ordered maps/sets
- `value.ml` / `value.mli`: scalar runtime values
- `port.ml` / `port.mli`: explicit node-port references
- `edge.ml` / `edge.mli`: source-to-target port edges
- `node_instance.ml` / `node_instance.mli`: graph-level node occurrences
- `graph_error.ml` / `graph_error.mli`: structural graph construction errors
- `graph.ml` / `graph.mli`: immutable validated graph and traversal helpers
- `graph_test.ml` / `graph_test.mli`: hand-built graph checks for the initial model
- `utop_load.ml`: toplevel loader for interactive experimentation and tests

Non-goals for this layer:
- node execution logic
- JSON decoding
- Java bridge handling
- cyclic/stateful execution strategies

Using this directory in `utop`:
- `#use "./ocaml-engine/graph/utop_load.ml";;`
- `Graph_test.run_all ();;`
