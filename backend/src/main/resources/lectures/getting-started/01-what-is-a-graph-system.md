:::lecture { "id": "logic--getting-started--what-is-a-graph-system", "slug": "what-is-a-graph-system", "path": { "slug": "logic", "title": "Logic", "description": "Reasoning-focused lessons and graph-building fundamentals." }, "category": { "slug": "getting-started", "title": "Getting Started", "description": "Start here when the first logic onboarding lectures arrive.", "hero": "Reserved for introductory logic lessons." }, "title": "What Is a Graph System?", "summary": "Understand nodes, edges, and how decisions flow through your system.", "estimatedMinutes": 10 }

:::sublecture { "id":"nodes-make-the-parts", "title":"Nodes Make The Parts" }

# Nodes Make The Parts

A graph system is a way to build a strategy step-by-step using small pieces instead of one big block.

## What a node represents

- A node is a box that does one job.
- Some nodes get data (like stock price).
- Some nodes compare values (like checking if one number is bigger than another).
- Some nodes take action (like buying or selling).

## How to use nodes

- Drag nodes from the menu onto the canvas.
- Each node you place becomes one step in your system.
- You can move nodes around to organize your graph.

## Why nodes matter

Nodes make everything easy to see.  
Instead of guessing how a decision was made, you can look at each step.

## Your first graph pieces

Start simple:

- Add a **Fetch Price Data** node (this gets the price)
- Add a **Buy** node (this is an action)

You now have:
> Input → Action (not connected yet)

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

Nodes only work together when you connect them.

## What an edge does

- An edge is a line between two nodes.
- It sends the output of one node into another.
- It controls the direction of data flow.

## How to connect nodes

- Click and drag from one node’s output to another node’s input.
- Once connected, data will move through that path.

## Why connections matter

Without connections, nothing happens.  
With connections, your system starts to make decisions.

## A simple decision chain

We are going to build this:

1. Get the price  
2. Compare it to a number  
3. Decide whether to buy  

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

Now your graph is actually doing something.

## The full picture

- Nodes = steps  
- Edges = connections  
- Flow = how data moves through the system  

Together, this creates a decision.

## How to think about your graph

Every graph follows the same pattern:

1. Get data  
2. Change or compare it  
3. Make a decision  

## Why this matters

Even complex strategies are just this pattern repeated more times.

## What to remember

If you can answer these, you understand your graph:

- Where does the data come from?  
- What happens to it?  
- What action does it lead to?  