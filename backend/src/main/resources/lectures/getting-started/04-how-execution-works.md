:::lecture { "id": "logic--getting-started--how-execution-works", "slug": "how-execution-works", "path": { "slug": "logic", "title": "Logic", "description": "Reasoning-focused lessons and graph-building fundamentals." }, "category": { "slug": "getting-started", "title": "Getting Started", "description": "Start here when the first logic onboarding lectures arrive.", "hero": "Reserved for introductory logic lessons." }, "title": "How Execution Works", "summary": "See how your graph actually runs step-by-step behind the scenes.", "estimatedMinutes": 12 }
:::sublecture { "id":"execution-starts-at-available-values", "title":"Execution Starts At Available Values" }
# Execution Starts At Available Values

When a graph runs, it does not think about the whole graph all at once. It works through the pieces as values become available.

## Where execution begins

Source-like nodes can produce values without waiting for anything upstream. Examples include:

- Constant Boolean
- Constant Number
- Fetch Price Data

## Why order matters

An `If` node cannot make a choice until it receives the inputs it depends on. Execution is really the story of values arriving at the right places.

## Build a branching setup

Create a small branch where a boolean condition can eventually choose between a fetched price and a fallback number.
:::checkpoint
{
  "id": "checkpoint-build-branch-inputs",
  "title": "Checkpoint 1: Build Branch Inputs",
  "instructions": [
    "Add one Fetch Price Data node.",
    "Add one Constant Number node.",
    "Connect Constant Boolean into If.",
    "Connect Fetch Price Data into If.",
    "Connect Constant Number into If."
  ],
  "tasks": [
    {
      "id": "task-add-fetch-for-branch",
      "label": "Add Fetch Price Data",
      "description": "Place a Fetch Price Data node to represent one possible branch value."
    },
    {
      "id": "task-add-fallback-number",
      "label": "Add Constant Number",
      "description": "Place a Constant Number node to represent the fallback branch value."
    },
    {
      "id": "task-connect-bool-into-if",
      "label": "Connect condition into If",
      "description": "Wire Constant Boolean into If."
    },
    {
      "id": "task-connect-price-into-if",
      "label": "Connect price branch into If",
      "description": "Wire Fetch Price Data into If."
    },
    {
      "id": "task-connect-number-into-if",
      "label": "Connect fallback into If",
      "description": "Wire Constant Number into If."
    }
  ],
  "sandboxPreset": {
    "allowedNodeTypes": ["const_bool", "fetch_price", "const_number", "if"],
    "starterNodes": [
      { "id": "branch-condition", "type": "const_bool", "position": { "x": 90, "y": 120 } },
      { "id": "branch-if", "type": "if", "position": { "x": 520, "y": 220 } }
    ],
    "starterEdges": []
  },
  "validation": [
    { "type": "node_exists", "nodeType": "fetch_price" },
    { "type": "node_exists", "nodeType": "const_number" },
    { "type": "connection_exists", "sourceType": "const_bool", "targetType": "if" },
    { "type": "connection_exists", "sourceType": "fetch_price", "targetType": "if" },
    { "type": "connection_exists", "sourceType": "const_number", "targetType": "if" }
  ]
}
:::
:::sublecture { "id":"conditions-run-before-branches-resolve", "title":"Conditions Run Before Branches Resolve" }
# Conditions Run Before Branches Resolve

Execution in a graph is local and dependency-driven.

## What happens behind the scenes

1. source nodes produce values
2. comparison nodes consume those values and compute signals
3. flow nodes such as `If` use those signals to choose a branch

## Why the condition is separate

Separating the condition from the branch makes the graph easier to inspect. You can see the question being asked before you see which path wins.

## Build the condition chain

The branch already has two possible values ready. Now wire in the comparison that tells the `If` node how to choose between them.
:::checkpoint
{
  "id": "checkpoint-build-condition-chain",
  "title": "Checkpoint 2: Build The Condition Chain",
  "instructions": [
    "Add a Greater Than node.",
    "Connect Fetch Price Data into Greater Than.",
    "Connect Constant Number into Greater Than.",
    "Connect Greater Than into If."
  ],
  "tasks": [
    {
      "id": "task-add-greater-than-for-condition",
      "label": "Add Greater Than",
      "description": "Place a Greater Than node so the graph can compute the condition before the branch."
    },
    {
      "id": "task-connect-price-into-condition",
      "label": "Connect price into Greater Than",
      "description": "Wire Fetch Price Data into Greater Than."
    },
    {
      "id": "task-connect-threshold-into-condition",
      "label": "Connect threshold into Greater Than",
      "description": "Wire Constant Number into Greater Than."
    },
    {
      "id": "task-connect-condition-into-if",
      "label": "Connect condition into If",
      "description": "Wire Greater Than into If."
    }
  ],
  "sandboxPreset": {
    "allowedNodeTypes": ["fetch_price", "const_number", "gt", "if"],
    "starterNodes": [
      { "id": "execution-price", "type": "fetch_price", "position": { "x": 80, "y": 150 } },
      { "id": "execution-threshold", "type": "const_number", "position": { "x": 80, "y": 310 } },
      { "id": "execution-if", "type": "if", "position": { "x": 600, "y": 230 } }
    ],
    "starterEdges": [
      { "id": "edge-price-to-if", "source": "execution-price", "target": "execution-if" },
      { "id": "edge-threshold-to-if", "source": "execution-threshold", "target": "execution-if" }
    ]
  },
  "validation": [
    { "type": "node_exists", "nodeType": "gt" },
    { "type": "connection_exists", "sourceType": "fetch_price", "targetType": "gt" },
    { "type": "connection_exists", "sourceType": "const_number", "targetType": "gt" },
    { "type": "connection_exists", "sourceType": "gt", "targetType": "if" }
  ]
}
:::
:::sublecture { "id":"execution-is-a-sequence-of-available-results", "title":"Execution Is A Sequence Of Available Results" }
# Execution Is A Sequence Of Available Results

The key idea is simple: a node can only run once the values it depends on are available.

## A useful mental model

Think of execution as a chain of readiness:

- source nodes are ready first
- intermediate nodes become ready when their inputs arrive
- downstream nodes become ready after the intermediate results exist

## Why this matters in practice

When a graph behaves strangely, the problem is often not "the whole system is broken." It is usually one missing value, one wrong connection, or one branch condition that never became ready the way you expected.

## Final takeaway

Understanding execution is really about understanding dependency order. If you can see what must happen first, second, and third, the graph stops feeling mysterious.
