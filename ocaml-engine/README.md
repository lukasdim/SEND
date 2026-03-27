# OCaml Engine Placeholder

This directory contains the OCaml worker and reusable engine library that will own graph execution.

Planned areas:
- `spec/` for JSON node-spec decoding
- `nodes/` for per-node executor implementations
- `graph/` for graph and runtime value structures
- `engine/` for scheduling and execution
- `market_data/` for read-only PostgreSQL/Timescale access
- `bin/` for the stdin/stdout worker entrypoint

Build system:
- Dune is the canonical build system for this OCaml project

Runtime boundary:
- Java remains the HTTP/process-management layer
- OCaml becomes the execution layer
- Java communicates with the OCaml worker over JSON Lines on `stdin`/`stdout`
