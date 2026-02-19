// src/pages/Sandbox.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  addEdge,
  Background,
  type Connection,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  getDefaultNodeData,
  getNodeVisual,
  isSupportedNodeType,
  nodePalette,
  nodeTypes,
} from "../components/nodes/NodeTypes";

const NODE_WIDTH = 240;
const LIBRARY_NODE_WIDTH = 180;
const NOTIFICATION_TIMEOUT_MS = 4200;

function hasLeftHandle(type: string | undefined): boolean {
  return type === "eps" || type === "outputNode";
}

function hasRightHandle(type: string | undefined): boolean {
  return type === "eps" || type === "start";
}

function getPreviewVisual(type: string): {
  border: string;
  background: string;
  accent: string;
} {
  const visual = getNodeVisual(type);
  if (!visual) return { border: "1px solid #d1d5db", background: "white", accent: "#16a34a" };
  return { border: "1px solid #d1d5db", background: visual.color, accent: visual.accent };
}

function translucent(color: string, alphaHex: string): string {
  if (color.startsWith("#") && color.length === 7) {
    return `${color}${alphaHex}`;
  }
  return color;
}

function NodeTemplatePreview({ type }: { type: string }) {
  const previewData = getDefaultNodeData(type);
  if (!previewData) return null;
  const visual = getPreviewVisual(type);
  const extra = previewData.extra ?? {};
  const extraEntries = Object.entries(extra as Record<string, unknown>);
  const hasBody = extraEntries.length > 0;

  return (
    <div
      style={{
        width: "100%",
        padding: 0,
        border: visual.border,
        borderRadius: 20,
        background: visual.background,
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        boxSizing: "border-box",
        overflow: "hidden",
        color: "black",
      }}
    >
      {hasLeftHandle(type) && <div style={previewLeftHandleStyle} />}
      <div
        style={{
          padding: "14px 16px",
          background: translucent(visual.accent, "1A"),
          borderBottom: hasBody ? "1px solid #e5e7eb" : undefined,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.1 }}>{previewData.label}</div>
      </div>
      {hasBody && (
        <div style={{ padding: "14px 16px", display: "flex", gap: 8 }}>
          {extraEntries.map(([key, value]) => (
            <input
              key={key}
              className="nodrag"
              readOnly
              disabled
              placeholder={key}
              value={typeof value === "string" ? value : ""}
              type={typeof value === "number" || value === null ? "number" : "text"}
              style={previewInputStyle}
            />
          ))}
        </div>
      )}
      {hasRightHandle(type) && <div style={previewRightHandleStyle} />}
    </div>
  );
}

function ErrorNotification({ message }: { message: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 14,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 30,
        pointerEvents: "none",
        width: "fit-content",
        minWidth: 380,
        maxWidth: "min(980px, calc(100vw - 40px))",
        animation: "sandboxErrorIn 220ms cubic-bezier(0.2, 0.9, 0.2, 1)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "42px 1fr",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          borderRadius: 12,
          background: "#fecaca",
          border: "1px solid #fca5a5",
          boxShadow: "0 12px 30px rgba(0, 0, 0, 0.2)",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 26,
            height: 26,
            borderRadius: 999,
            background: "white",
            color: "#b91c1c",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          !
        </div>

        <div
          style={{
            color: "#7f1d1d",
            fontSize: 14,
            lineHeight: 1.35,
            whiteSpace: "normal",
            wordBreak: "break-word",
          }}
        >
          {message}
        </div>
      </div>
    </div>
  );
}

function SandboxInner() {
  const { screenToFlowPosition } = useReactFlow();
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingPointerNodeType, setPendingPointerNodeType] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const notifyError = useCallback((message: string) => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    setErrorMessage(message);
    timeoutRef.current = window.setTimeout(() => {
      setErrorMessage("");
      timeoutRef.current = null;
    }, NOTIFICATION_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const initialNodes: Node[] = useMemo(() => [], []);
  const initialEdges: Edge[] = useMemo(() => [], []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const graphDatabase = useMemo(() => {
    return {
      nodes: nodes.map((node) => {
        const incoming = edges
          .filter((edge) => edge.target === node.id)
          .map((edge) => edge.source)
          .filter((source): source is string => Boolean(source));
        const outgoing = edges
          .filter((edge) => edge.source === node.id)
          .map((edge) => edge.target)
          .filter((target): target is string => Boolean(target));

        return {
          nodeId: node.id,
          nodeType: node.type,
          leftConnection: hasLeftHandle(node.type) ? incoming : [],
          rightConnection: hasRightHandle(node.type) ? outgoing : [],
          extraData:
            node.data && typeof node.data === "object" && "extra" in node.data
              ? (node.data as { extra?: Record<string, unknown> }).extra ?? null
              : null,
        };
      }),
    };
  }, [edges, nodes]);

  const onConnect = useCallback(
    (params: Edge | Connection) =>
      setEdges((eds) =>
        addEdge({ ...params, type: "smoothstep", animated: true }, eds)
      ),
    [setEdges]
  );

  const tryCreateNode = useCallback(
    (type: string, position: { x: number; y: number }) => {
      if (!isSupportedNodeType(type)) {
        notifyError("Unsupported node type dropped. Please drag a valid node from the sidebar.");
        return false;
      }

      const nodeData = getDefaultNodeData(type);
      if (!nodeData) {
        notifyError("Node configuration is missing for this type. Please refresh and try again.");
        return false;
      }

      if (type === "start" || type === "outputNode") {
        const hasExistingSingleton = nodes.some((node) => node.type === type);
        if (hasExistingSingleton) {
          notifyError(
            type === "start"
              ? "Only one Start node is allowed in the canvas."
              : "Only one Output node is allowed in the canvas."
          );
          return false;
        }
      }

      const newNode: Node = {
        id: `n-${crypto.randomUUID()}`,
        type,
        position,
        data: nodeData,
        style: { width: NODE_WIDTH, color: "black" },
      };

      setNodes((nds) => nds.concat(newNode));
      return true;
    },
    [nodes, notifyError, setNodes]
  );

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.clearData();

    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.setData("text/plain", nodeType);
    event.dataTransfer.setData("text", nodeType);
    const dragElement = event.currentTarget as HTMLElement;
    event.dataTransfer.setDragImage(
      dragElement,
      dragElement.offsetWidth / 2,
      dragElement.offsetHeight / 2
    );

    event.dataTransfer.effectAllowed = "move";
  };

  const onTemplatePointerDown = useCallback(
    (event: React.PointerEvent, nodeType: string) => {
      if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
      event.preventDefault();
      setPendingPointerNodeType(nodeType);
    },
    []
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      tryCreateNode(type, position);
    },
    [screenToFlowPosition, tryCreateNode]
  );

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (!pendingPointerNodeType) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      tryCreateNode(pendingPointerNodeType, position);
      setPendingPointerNodeType(null);
    },
    [pendingPointerNodeType, screenToFlowPosition, tryCreateNode]
  );

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        height: "100vh",
        width: "100vw",
        minHeight: 0,
      }}
    >
      <style>{`
        @keyframes sandboxErrorIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-24px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>

      {errorMessage && <ErrorNotification message={errorMessage} />}

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

        {nodePalette.map((node) => (
          <div key={node.type} style={nodeTemplateWrapperStyle}>
            <div
              draggable
              onDragStart={(e) => onDragStart(e, node.type)}
              onPointerDown={(e) => onTemplatePointerDown(e, node.type)}
              style={nodeTemplateDraggableStyle}
            >
              <NodeTemplatePreview type={node.type} />
            </div>
          </div>
        ))}

        <div style={{ marginTop: 16, fontSize: 12, color: "#6b7280" }}>
          Drag a node onto the canvas.
          <br />
          (Edges will work after we add node handles.)
        </div>

        {pendingPointerNodeType && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#92400e" }}>
            Touch mode: tap the canvas to place this node.
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 12, color: "#374151" }}>Graph JSON</div>
        <pre
          style={{
            marginTop: 8,
            padding: 8,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            background: "#f9fafb",
            fontSize: 11,
            color: "#111827",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 260,
            overflow: "auto",
          }}
        >
          {JSON.stringify(graphDatabase, null, 2)}
        </pre>
      </div>

      <div style={{ flex: 1, minHeight: 0, height: "100%", width: "100%" }}>
        <ReactFlow
          nodeTypes={nodeTypes}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onPaneClick={onPaneClick}
          nodeOrigin={[0.5, 0.5]}
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

const nodeTemplateWrapperStyle: React.CSSProperties = {
  width: LIBRARY_NODE_WIDTH,
  marginBottom: 12,
  overflow: "visible",
};

const nodeTemplateDraggableStyle: React.CSSProperties = {
  width: "100%",
  cursor: "grab",
  userSelect: "none",
  WebkitUserSelect: "none",
};

const previewInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "6px 8px",
  fontSize: 12,
  lineHeight: 1.2,
  background: "white",
  color: "#6b7280",
};

const previewLeftHandleStyle: React.CSSProperties = {
  position: "absolute",
  left: -8,
  top: "50%",
  transform: "translateY(-50%)",
  width: 14,
  height: 14,
  borderRadius: 999,
  background: "#94a3b8",
  border: "2px solid #f8fafc",
};

const previewRightHandleStyle: React.CSSProperties = {
  position: "absolute",
  right: -8,
  top: "50%",
  transform: "translateY(-50%)",
  width: 14,
  height: 14,
  borderRadius: 999,
  background: "#94a3b8",
  border: "2px solid #f8fafc",
};

export default function Sandbox() {
  return (
    <ReactFlowProvider>
      <SandboxInner />
    </ReactFlowProvider>
  );
}
