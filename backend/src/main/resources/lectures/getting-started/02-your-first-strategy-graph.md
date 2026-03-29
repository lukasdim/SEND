:::lecture { "id": "logic--getting-started--your-first-strategy-graph", "slug": "your-first-strategy-graph", "path": { "slug": "logic", "title": "Logic", "description": "Reasoning-focused lessons and graph-building fundamentals." }, "category": { "slug": "getting-started", "title": "Getting Started", "description": "Start here when the first logic onboarding lectures arrive.", "hero": "Reserved for introductory logic lessons." }, "title": "Your First Strategy Graph", "summary": "Build a simple graph that turns price data into a decision.", "estimatedMinutes": 12 }
:::sublecture { "id":"start-with-a-market-input", "title":"Start With A Market Input" }
# Start With A Market Input

A strategy graph begins with a source of information.

## What the input node does

Fetch Price Data gives the graph a number it can reason about. That number is not a decision yet. It is just the raw material for one.

## Why configuration matters

The node is only useful when it points at the market data you care about. A graph is not just shape. It is shape plus settings.

## Build the first input

Add a Fetch Price Data node, then configure it to look at `AAPL`. That turns a generic market input into the start of a specific strategy.
:::checkpoint
{
  "id": "checkpoint-configure-price-input",
  "title": "Checkpoint 1: Configure The Price Input",
  "instructions": [
    "Add one Fetch Price Data node.",
    "Set its ticker field to AAPL."
  ],
  "tasks": [
    {
      "id": "task-add-price-input",
      "label": "Add Fetch Price Data",
      "description": "Place a Fetch Price Data node on the canvas."
    },
    {
      "id": "task-set-price-ticker",
      "label": "Set ticker to AAPL",
      "description": "Update the Fetch Price Data node so its ticker field is AAPL."
    }
  ],
  "sandboxPreset": {
    "allowedNodeTypes": ["fetch_price", "const_number", "gt", "buy"],
    "starterNodes": [],
    "starterEdges": []
  },
  "validation": [
    { "type": "node_exists", "nodeType": "fetch_price" },
    { "type": "node_field_equals", "nodeType": "fetch_price", "field": "ticker", "expected": "AAPL" }
  ]
}
:::
:::sublecture { "id":"turn-input-into-a-signal", "title":"Turn Input Into A Signal" }
# Turn Input Into A Signal

Raw data becomes useful only after you compare it to something.

## Why a threshold helps

A threshold gives the graph a question to answer: is the observed value above or below a level that matters?

## The shape of a first signal

One of the simplest strategy patterns is:

1. fetch a price
2. compare it to a number
3. use the boolean result to trigger an action

## Build the first strategy flow

Use a Constant Number as the threshold, then wire the comparison into Buy so the graph has a clear decision path.
:::checkpoint
{
  "id": "checkpoint-build-first-strategy-flow",
  "title": "Checkpoint 2: Build The First Strategy Flow",
  "instructions": [
    "Add a Greater Than node.",
    "Connect Fetch Price Data into Greater Than.",
    "Set the Constant Number node value to 150.",
    "Connect Constant Number into Greater Than.",
    "Connect Greater Than into Buy."
  ],
  "tasks": [
    {
      "id": "task-add-comparison-node",
      "label": "Add Greater Than",
      "description": "Place a Greater Than node in the middle of the strategy."
    },
    {
      "id": "task-connect-price-into-comparison",
      "label": "Connect price into comparison",
      "description": "Wire Fetch Price Data into Greater Than."
    },
    {
      "id": "task-set-threshold-value",
      "label": "Set threshold to 150",
      "description": "Update the Constant Number node value to 150."
    },
    {
      "id": "task-connect-threshold-into-comparison",
      "label": "Connect threshold into comparison",
      "description": "Wire Constant Number into Greater Than."
    },
    {
      "id": "task-connect-comparison-into-buy",
      "label": "Connect comparison into Buy",
      "description": "Wire Greater Than into Buy."
    }
  ],
  "sandboxPreset": {
    "allowedNodeTypes": ["fetch_price", "const_number", "gt", "buy"],
    "starterNodes": [
      { "id": "strategy-price", "type": "fetch_price", "position": { "x": 90, "y": 170 } },
      { "id": "strategy-threshold", "type": "const_number", "position": { "x": 90, "y": 320 } },
      { "id": "strategy-buy", "type": "buy", "position": { "x": 540, "y": 240 } }
    ],
    "starterEdges": []
  },
  "validation": [
    { "type": "node_exists", "nodeType": "gt" },
    { "type": "node_field_equals", "nodeType": "const_number", "field": "value", "expected": 150 },
    { "type": "connection_exists", "sourceType": "fetch_price", "targetType": "gt" },
    { "type": "connection_exists", "sourceType": "const_number", "targetType": "gt" },
    { "type": "connection_exists", "sourceType": "gt", "targetType": "buy" }
  ]
}
:::
:::sublecture { "id":"see-the-complete-shape", "title":"See The Complete Shape" }
# See The Complete Shape

You now have the skeleton of a real strategy graph.

## What each part means

- Fetch Price Data gives the graph an observed market value.
- Constant Number gives the graph a level to compare against.
- Greater Than turns the comparison into a true-or-false signal.
- Buy turns that signal into a possible action.

## Why this matters

Even a simple graph already separates concerns cleanly. Data collection, reasoning, and action each have a visible place in the flow.

## Next step

As graphs grow, the same pattern stays useful. Every additional node should still earn its place by making the decision easier to explain.
