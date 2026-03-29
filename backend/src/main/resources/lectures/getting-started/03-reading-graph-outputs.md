:::lecture { "id": "logic--getting-started--reading-graph-outputs", "slug": "reading-graph-outputs", "path": { "slug": "logic", "title": "Logic", "description": "Reasoning-focused lessons and graph-building fundamentals." }, "category": { "slug": "getting-started", "title": "Getting Started", "description": "Start here when the first logic onboarding lectures arrive.", "hero": "Reserved for introductory logic lessons." }, "title": "Reading Graph Outputs", "summary": "Learn how to interpret results and signals from your system.", "estimatedMinutes": 11 }
:::sublecture { "id":"outputs-are-what-nodes-emit", "title":"Outputs Are What Nodes Emit" }
# Outputs Are What Nodes Emit

Every node exists to produce something the next step can use.

## What an output is

- A number can be an output.
- A boolean signal can be an output.
- An action trigger can be an output.

## How to read one

Ask two questions:

1. what kind of value does this node produce?
2. what should the next node do with it?

## Practice reading a transformed value

The `Abs` node is a good example because it transforms one numeric value into another numeric value. Build that tiny output chain first.
:::checkpoint
{
  "id": "checkpoint-build-output-transform",
  "title": "Checkpoint 1: Build An Output Transform",
  "instructions": [
    "Add an Abs node.",
    "Connect Fetch Price Data into Abs."
  ],
  "tasks": [
    {
      "id": "task-add-abs-node",
      "label": "Add Abs",
      "description": "Place an Abs node on the canvas."
    },
    {
      "id": "task-connect-price-into-abs",
      "label": "Connect price into Abs",
      "description": "Wire Fetch Price Data into Abs so one output becomes another."
    }
  ],
  "sandboxPreset": {
    "allowedNodeTypes": ["fetch_price", "abs", "const_number", "gt"],
    "starterNodes": [
      { "id": "output-price", "type": "fetch_price", "position": { "x": 100, "y": 220 } }
    ],
    "starterEdges": []
  },
  "validation": [
    { "type": "node_exists", "nodeType": "abs" },
    { "type": "connection_exists", "sourceType": "fetch_price", "targetType": "abs" }
  ]
}
:::
:::sublecture { "id":"signals-are-outputs-too", "title":"Signals Are Outputs Too" }
# Signals Are Outputs Too

Not every output is a number. Some outputs answer a yes-or-no question.

## Why boolean signals matter

A comparison node often produces the exact signal that an action node needs. That means an output can be the final answer to a decision question.

## One useful pattern

You can treat a transformed number as the input to a comparison. That lets the graph turn a raw value into a readable signal.

## Build a readable signal path

Take the transformed output from `Abs`, compare it against a threshold, and you have a signal you can interpret as "above" or "not above."
:::checkpoint
{
  "id": "checkpoint-build-signal-from-output",
  "title": "Checkpoint 2: Build A Signal From An Output",
  "instructions": [
    "Add a Greater Than node.",
    "Connect Abs into Greater Than.",
    "Connect Constant Number into Greater Than."
  ],
  "tasks": [
    {
      "id": "task-add-signal-node",
      "label": "Add Greater Than",
      "description": "Place a Greater Than node to turn a numeric output into a signal."
    },
    {
      "id": "task-connect-abs-into-signal",
      "label": "Connect Abs into Greater Than",
      "description": "Wire the transformed output into the comparison."
    },
    {
      "id": "task-connect-threshold-into-signal",
      "label": "Connect threshold into Greater Than",
      "description": "Wire Constant Number into the comparison as the threshold."
    }
  ],
  "sandboxPreset": {
    "allowedNodeTypes": ["fetch_price", "abs", "const_number", "gt"],
    "starterNodes": [
      { "id": "signal-price", "type": "fetch_price", "position": { "x": 80, "y": 170 } },
      { "id": "signal-abs", "type": "abs", "position": { "x": 320, "y": 170 } },
      { "id": "signal-threshold", "type": "const_number", "position": { "x": 320, "y": 320 } }
    ],
    "starterEdges": [
      { "id": "edge-price-abs", "source": "signal-price", "target": "signal-abs" }
    ]
  },
  "validation": [
    { "type": "node_exists", "nodeType": "gt" },
    { "type": "connection_exists", "sourceType": "abs", "targetType": "gt" },
    { "type": "connection_exists", "sourceType": "const_number", "targetType": "gt" }
  ]
}
:::
:::sublecture { "id":"interpret-the-shape-not-just-the-node", "title":"Interpret The Shape, Not Just The Node" }
# Interpret The Shape, Not Just The Node

Reading graph outputs is really about reading the relationship between steps.

## A better question to ask

Instead of asking "what does this node do?", ask:

- what value came into it?
- what value came out of it?
- what does the next node think that output means?

## Why this makes debugging easier

When you can read outputs clearly, you can find where a graph went wrong. Maybe the input was wrong. Maybe the threshold was wrong. Maybe the comparison was right, but the action node was downstream of the wrong signal.

## Mental shortcut

Outputs are the language each node uses to talk to the next one. If you understand the message being passed, the whole graph becomes easier to reason about.
