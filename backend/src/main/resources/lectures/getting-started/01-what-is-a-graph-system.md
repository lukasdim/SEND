:::lecture { "id": "logic--getting-started--what-is-a-graph-system", "slug": "what-is-a-graph-system", "path": { "slug": "logic", "title": "Logic", "description": "Reasoning-focused lessons and graph-building fundamentals." }, "category": { "slug": "getting-started", "title": "Getting Started", "description": "Start here when the first logic onboarding lectures arrive.", "hero": "Reserved for introductory logic lessons." }, "title": "What Is a Graph System?", "summary": "Understand nodes, edges, and how decisions flow through your system.", "estimatedMinutes": 10 }
:::sublecture { "id":"nodes-make-the-parts", "title":"Nodes Make The Parts" }
# Nodes Make The Parts

A graph system is a way of expressing a decision as connected pieces instead of one giant block of hidden logic.

## What a node represents

- A node is one unit of work inside the system.
- Some nodes fetch information, like a price.
- Some nodes compare values, like checking whether one number is greater than another.
- Some nodes take action, like buying or selling.

## Why nodes matter

Breaking a system into nodes makes the logic visible. Instead of wondering where a decision came from, you can point to the exact step that produced it.

## Your first graph pieces

Start by placing two very different kinds of nodes: one that gathers information and one that can act on it. That is the basic rhythm of most strategy graphs.
:::checkpoint
{
  "id": "checkpoint-place-core-nodes",
  "title": "Checkpoint 1: Place The Core Parts",
  "instructions": [
    "Add one Fetch Price Data node to represent market input.",
    "Add one Buy node to represent an action the graph could eventually trigger."
  ],
  "tasks": [
    {
      "id": "task-place-fetch-price",
      "label": "Add Fetch Price Data",
      "description": "Place a Fetch Price Data node on the canvas."
    },
    {
      "id": "task-place-buy-node",
      "label": "Add Buy",
      "description": "Place a Buy node on the canvas."
    }
  ],
  "sandboxPreset": {
    "allowedNodeTypes": ["fetch_price", "buy", "const_number"],
    "starterNodes": [],
    "starterEdges": []
  },
  "validation": [
    { "type": "node_exists", "nodeType": "fetch_price" },
    { "type": "node_exists", "nodeType": "buy" }
  ]
}
:::
:::sublecture { "id":"edges-carry-meaning", "title":"Edges Carry Meaning" }
# Edges Carry Meaning

Nodes become a system only when you connect them.

## What an edge does

- An edge passes the output of one node into another node.
- It tells the graph which step should feed the next step.
- It turns separate parts into a sequence you can reason about.

## Why connections matter

Without edges, a graph is just a pile of parts. With edges, it becomes a flow of meaning: input becomes comparison, and comparison becomes action.

## A simple decision chain

One common pattern is:

1. Fetch a value.
2. Compare it to a threshold.
3. Use the result to decide whether an action should fire.

Build that pattern now.
:::checkpoint
{
  "id": "checkpoint-connect-a-decision-chain",
  "title": "Checkpoint 2: Connect A Decision Chain",
  "instructions": [
    "Add a Greater Than node.",
    "Connect Fetch Price Data into Greater Than.",
    "Connect Constant Number into Greater Than.",
    "Connect Greater Than into Buy."
  ],
  "tasks": [
    {
      "id": "task-place-greater-than",
      "label": "Add Greater Than",
      "description": "Place a Greater Than node between the market input and the action."
    },
    {
      "id": "task-connect-price-to-compare",
      "label": "Connect price to comparison",
      "description": "Wire Fetch Price Data into Greater Than."
    },
    {
      "id": "task-connect-threshold-to-compare",
      "label": "Connect threshold to comparison",
      "description": "Wire Constant Number into Greater Than."
    },
    {
      "id": "task-connect-compare-to-buy",
      "label": "Connect comparison to action",
      "description": "Wire Greater Than into Buy."
    }
  ],
  "sandboxPreset": {
    "allowedNodeTypes": ["fetch_price", "const_number", "gt", "buy"],
    "starterNodes": [
      { "id": "starter-price", "type": "fetch_price", "position": { "x": 110, "y": 180 } },
      { "id": "starter-threshold", "type": "const_number", "position": { "x": 110, "y": 310 } },
      { "id": "starter-buy", "type": "buy", "position": { "x": 520, "y": 230 } }
    ],
    "starterEdges": []
  },
  "validation": [
    { "type": "node_exists", "nodeType": "gt" },
    { "type": "connection_exists", "sourceType": "fetch_price", "targetType": "gt" },
    { "type": "connection_exists", "sourceType": "const_number", "targetType": "gt" },
    { "type": "connection_exists", "sourceType": "gt", "targetType": "buy" }
  ]
}
:::
:::sublecture { "id":"flow-turns-logic-into-behavior", "title":"Flow Turns Logic Into Behavior" }
# Flow Turns Logic Into Behavior

You now have the basic mental model for a graph system.

## The full picture

- Nodes define the roles in the system.
- Edges define how information moves between those roles.
- The overall flow explains why a final decision happened.

## Why this scales

A larger graph is not a different kind of thing. It is just the same idea repeated more carefully:

1. gather inputs
2. transform them
3. compare them
4. choose an action

## What to remember

If you can point to a node, a connection, and the direction of flow, you can usually explain what the graph is trying to do.
