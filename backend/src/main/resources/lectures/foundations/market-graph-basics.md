:::lecture { "id": "logic--foundations--market-graph-basics", "slug": "market-graph-basics", "path": { "slug": "logic", "title": "Logic", "description": "Reasoning-focused lessons and graph-building fundamentals." }, "category": { "slug": "foundations", "title": "Foundations", "description": "Start with the structure of SEND lectures, the flow of gated sublectures, and the first graph-building patterns.", "hero": "Category-driven learning paths with unlockable checkpoints." }, "title": "Building Your First Decision Graph", "summary": "Learn how SEND lectures unlock in stages while you build a tiny graph between each sublecture.", "estimatedMinutes": 12 }
:::sublecture { "id":"getting-started", "title":"Getting Started" }
# Getting Started

Welcome to SEND's first guided lecture. This lesson introduces the idea behind a decision graph: a chain of nodes that turns market information into actions.

## What you are building

- A simple visual path from a market idea to an action.
- A graph that can grow one decision at a time.
- A habit of testing before moving to the next concept.

## Why the structure matters

The section rail on the left represents the sublectures inside this lesson. Some sections stay locked until you complete the checkpoint between them. This keeps each lecture paced and prevents skipping into unfinished concepts.

## Before you continue

Read the current section, then use the mini-sandbox below to place the first required node and verify your progress.
:::checkpoint
{
  "id": "checkpoint-place-buy",
  "title": "Checkpoint 1: Add Your First Action",
  "instructions": [
    "Use the palette to add a Buy node to the mini-sandbox.",
    "Run verification once the required node is on the canvas."
  ],
  "tasks": [
    {
      "id": "task-place-buy",
      "label": "Add a Buy node",
      "description": "Place a Buy node anywhere inside the mini-sandbox canvas."
    }
  ],
  "sandboxPreset": {
    "allowedNodeTypes": ["buy", "fetch_price", "const_number"],
    "starterNodes": [],
    "starterEdges": []
  },
  "validation": [
    { "type": "node_count", "nodeType": "buy", "count": 1 }
  ]
}
:::
:::sublecture { "id":"conditions-and-flow", "title":"Conditions and Flow" }
# Conditions and Flow

You have the first action node in place. The next step is to make your graph choose `when` that action should fire.

## Decision nodes

An `If` node acts like a gate. It takes in information, evaluates a condition, and then routes the graph toward the correct branch.

## How this affects lecture pacing

- Once a checkpoint passes, the next sublecture becomes available immediately.
- Locked sections remain visible in the rail so learners can see what is ahead.
- Unlocking is based on backend verification, not just UI interaction.

## Your next checkpoint

Connect a decision node so the graph shows a clear path from logic to action. When the verification passes, the final sublecture will unlock.
:::checkpoint
{
  "id": "checkpoint-wire-if",
  "title": "Checkpoint 2: Connect Logic to Action",
  "instructions": [
    "Add an If node if you do not have one yet.",
    "Connect the If node to the Buy node to form a decision path."
  ],
  "tasks": [
    {
      "id": "task-place-if",
      "label": "Add an If node",
      "description": "Place an If node so the graph has a logic gate."
    },
    {
      "id": "task-connect-if-buy",
      "label": "Connect If to Buy",
      "description": "Create a connection from the If node to the Buy node."
    }
  ],
  "sandboxPreset": {
    "allowedNodeTypes": ["buy", "if", "sell", "fetch_price"],
    "starterNodes": [
      { "id": "starter-buy", "type": "buy", "position": { "x": 420, "y": 160 } }
    ],
    "starterEdges": []
  },
  "validation": [
    { "type": "node_exists", "nodeType": "if" },
    { "type": "connection_exists", "sourceType": "if", "targetType": "buy" }
  ]
}
:::
:::sublecture { "id":"reading-the-map", "title":"Reading the Map" }
# Reading the Map

You now have a small but complete lecture flow: an action node, a decision node, and a verified unlock sequence.

## What this lecture demonstrated

1. Lecture content can be broken into ordered sublectures.
2. Every checkpoint lives between two sublectures.
3. Verification unlocks the next section without leaving the page.

## Where this goes next

Future lectures can swap in richer copy, more checkpoint tasks, and a tighter backend integration without changing the overall page structure.

## Help and review

Use the section rail to revisit any unlocked content. Completed sections remain available so learners can review before moving on to deeper topics.
