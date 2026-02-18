// src/pages/Sandbox.tsx
import { useCallback, useMemo, useRef, useState } from "react";
import ReactFlow, {
  addEdge,
  Background,
  type Connection,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  type ReactFlowInstance,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { nodeTypes } from "../components/nodes/NodeTypes";
import type { NodeData } from "../components/nodes/BaseNode";

type DragNodeType = "price" | "indicator" | "logic";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 56;


function SandboxInner() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  const initialNodes: Node[] = useMemo(() => [], []);
  const initialEdges: Edge[] = useMemo(() => [], []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

const onConnect = useCallback(
  (params: Edge | Connection) =>
    setEdges((eds) =>
      addEdge({ ...params, type: "smoothstep", animated: true }, eds) // TODO: change animated to false and turn it to true once submitted and running
    ),
  [setEdges]
);


  const onDragStart = (event: React.DragEvent, nodeType: DragNodeType) => {
    event.dataTransfer.clearData();

    // Edge can be picky; set multiple keys
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.setData("text/plain", nodeType);
    event.dataTransfer.setData("text", nodeType);

    event.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault(); // REQUIRED to allow drop
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow") as DragNodeType;
      if (!type || !rfInstance || !wrapperRef.current) return;

      const bounds = wrapperRef.current.getBoundingClientRect();
      const position = rfInstance.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const label =
        type === "price" ? "Price" : type === "indicator" ? "Indicator" : "Logic";

        const subtitle =
        type === "price"
            ? "Data source"
            : type === "indicator"
            ? "Transforms data"
            : "Decision rule";

        const newNode: Node = {
            id: `n-${crypto.randomUUID()}`,
            type, // "price" | "indicator" | "logic"
            position,
            data: { label, subtitle } satisfies NodeData,
            style: { width: NODE_WIDTH, height: NODE_HEIGHT },
        };

      setNodes((nds) => nds.concat(newNode));
    },
    [rfInstance, setNodes]
  );

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", minHeight: 0 }}>
      {/* Sidebar */}
      <div
        style={{
          width: 220,
          padding: 12,
          borderRight: "1px solid #e5e7eb",
          fontFamily: "system-ui, sans-serif",
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Nodes</div>

        <div draggable onDragStart={(e) => onDragStart(e, "price")} style={tileStyle}>
          Price
        </div>

        <div
          draggable
          onDragStart={(e) => onDragStart(e, "indicator")}
          style={tileStyle}
        >
          Indicator
        </div>

        <div draggable onDragStart={(e) => onDragStart(e, "logic")} style={tileStyle}>
          Logic
        </div>

        <div style={{ marginTop: 16, fontSize: 12, color: "#6b7280" }}>
          Drag a node onto the canvas.
          <br />
          (Edges will work after we add node handles.)
        </div>
      </div>

      {/* Canvas - MUST have explicit size */}
      <div
        ref={wrapperRef}
        style={{
          flex: 1,
          minHeight: 0,
          height: "100%",
          width: "100%",
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <ReactFlow
          nodeTypes={nodeTypes}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setRfInstance}
          fitView
        >
          <Background />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

const tileStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  marginBottom: 10,
  cursor: "grab",
  background: "white",
  userSelect: "none",
  WebkitUserSelect: "none",
};

export default function Sandbox() {
  return (
    <ReactFlowProvider>
      <SandboxInner />
    </ReactFlowProvider>
  );
}
