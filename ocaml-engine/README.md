# OCaml Engine Placeholder

This directory is reserved for the OCaml worker that will own graph execution.

Planned areas:
- `spec/` for JSON node-spec decoding
- `nodes/` for per-node executor implementations
- `graph/` for graph and runtime value structures
- `engine/` for scheduling and execution
- `bin/` for the stdin/stdout worker entrypoint

Java will remain the HTTP layer. OCaml will become the execution layer.
