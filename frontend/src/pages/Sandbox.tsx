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
import {
  NODE_CARD_BORDER,
  NODE_CARD_RADIUS,
  NODE_HANDLE_STYLE,
  NODE_TITLE_ALPHA,
  NODE_TITLE_PADDING,
  withAlpha,
} from "../components/nodes/base/nodeCardStyle";
import {
  SANDBOX_DEFAULT_UNTITLED_STRATEGY_NAME,
  SANDBOX_LIBRARY_NODE_WIDTH,
  SANDBOX_NODE_WIDTH,
  SANDBOX_NOTIFICATION_TIMEOUT_MS,
  SANDBOX_STRATEGIES_API,
} from "../config/sandboxConfig";

type StrategySummary = {
  id: string;
  name: string;
  lastEdited: string;
};

type GraphNodePayload = {
  id: string;
  type: string;
  position: {
    x: number;
    y: number;
  };
  data: Record<string, unknown>;
};

type GraphEdgePayload = {
  id: string;
  source: string;
  target: string;
};

type GraphPayload = {
  nodes: GraphNodePayload[];
  edges: GraphEdgePayload[];
};

type BackendGraphDto = {
  id: string;
  nodes: unknown[];
  edges: unknown[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toSerializableNodeType(type: string | undefined): string {
  if (type === "outputNode") return "output";
  return type ?? "unknown";
}

function toFlowNodeType(type: string): string | undefined {
  if (type === "output") return "outputNode";
  if (isSupportedNodeType(type)) return type;
  return undefined;
}

function formatLastEdited(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

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
  if (!visual) return { border: NODE_CARD_BORDER, background: "white", accent: "#16a34a" };
  return { border: NODE_CARD_BORDER, background: visual.color, accent: visual.accent };
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
        borderRadius: NODE_CARD_RADIUS,
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
          padding: NODE_TITLE_PADDING,
          background: withAlpha(visual.accent, NODE_TITLE_ALPHA),
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
  const { fitView, screenToFlowPosition } = useReactFlow();
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingPointerNodeType, setPendingPointerNodeType] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<StrategySummary[]>([]);
  const [isStrategiesLoading, setIsStrategiesLoading] = useState(false);
  const [strategiesError, setStrategiesError] = useState("");
  const [currentStrategyId, setCurrentStrategyId] = useState<string | null>(null);
  const [currentStrategyName, setCurrentStrategyName] = useState<string | null>(null);
  const [isStrategyLoading, setIsStrategyLoading] = useState(false);
  const [isStrategySaving, setIsStrategySaving] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const notifyError = useCallback((message: string) => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    setErrorMessage(message);
    timeoutRef.current = window.setTimeout(() => {
      setErrorMessage("");
      timeoutRef.current = null;
    }, SANDBOX_NOTIFICATION_TIMEOUT_MS);
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
    const minX = nodes.length > 0 ? Math.min(...nodes.map((node) => node.position.x)) : 0;
    const minY = nodes.length > 0 ? Math.min(...nodes.map((node) => node.position.y)) : 0;

    return {
      nodes: nodes.map((node) => {
        const extra =
          node.data && typeof node.data === "object" && "extra" in node.data
            ? ((node.data as { extra?: Record<string, unknown> }).extra ?? {})
            : {};

        const data = Object.fromEntries(
          Object.entries(extra).filter(([, value]) => value !== null && value !== undefined)
        );

        return {
          id: node.id,
          type: toSerializableNodeType(node.type),
          position: {
            x: Math.round(node.position.x - minX),
            y: Math.round(node.position.y - minY),
          },
          data,
        };
      }),
      edges: edges.map((edge, index) => ({
        id: edge.id || `e-${index + 1}`,
        source: edge.source,
        target: edge.target,
      })),
    } satisfies GraphPayload;
  }, [edges, nodes]);

  const fetchStrategies = useCallback(
    async (signal?: AbortSignal) => {
      setIsStrategiesLoading(true);
      setStrategiesError("");

      try {
        const response = await fetch(SANDBOX_STRATEGIES_API.listStrategiesUrl, {
          method: "GET",
          signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch strategies (${response.status})`);
        }

        const payload = (await response.json()) as unknown;
        const nextStrategies = Array.isArray(payload)
          ? payload.flatMap((strategy) => {
              if (!isRecord(strategy)) return [];
              const { id } = strategy;
              if (typeof id !== "string" || id.length === 0) return [];
              return [{ id, name: id, lastEdited: "-" }];
            })
          : [];

        setStrategies(nextStrategies);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStrategies([]);
        setStrategiesError("Could not load strategies.");
        notifyError("Could not load previous strategies. Please try again.");
      } finally {
        setIsStrategiesLoading(false);
      }
    },
    [notifyError]
  );

  useEffect(() => {
    if (nodes.length > 0) return;

    const abortController = new AbortController();
    void fetchStrategies(abortController.signal);
    return () => {
      abortController.abort();
    };
  }, [fetchStrategies, nodes.length]);

  const loadStrategy = useCallback(
    async (strategy: StrategySummary) => {
      setIsStrategyLoading(true);
      setStrategiesError("");

      try {
        const response = await fetch(
          SANDBOX_STRATEGIES_API.strategyByIdUrl(strategy.id),
          { method: "GET" }
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch strategy (${response.status})`);
        }

        const payload = (await response.json()) as {
          id?: unknown;
          nodes?: unknown;
          edges?: unknown;
        };
        if (!Array.isArray(payload.nodes) || !Array.isArray(payload.edges)) {
          throw new Error("Strategy data is malformed.");
        }

        const loadedNodes: Node[] = payload.nodes.flatMap((rawNode) => {
          if (!isRecord(rawNode)) return [];

          const { data, id, position, type } = rawNode;
          const finalPosition =
            isRecord(position) && typeof position.x === "number" && typeof position.y === "number"
              ? { x: position.x, y: position.y }
              : null;

          if (
            typeof id !== "string" ||
            typeof type !== "string" ||
            !finalPosition
          ) {
            return [];
          }

          const flowNodeType = toFlowNodeType(type);
          if (!flowNodeType) return [];

          const baseData = getDefaultNodeData(flowNodeType);
          if (!baseData) return [];

          const mergedExtra = {
            ...(baseData.extra ?? {}),
            ...(isRecord(data) ? data : {}),
          };
          const nextData =
            Object.keys(mergedExtra).length > 0
              ? { ...baseData, extra: mergedExtra }
              : { ...baseData };

          return [
            {
              id,
              type: flowNodeType,
              position: finalPosition,
              data: nextData,
              style: { width: SANDBOX_NODE_WIDTH, color: "black" },
            },
          ];
        });

        const loadedEdges: Edge[] = payload.edges.flatMap((rawEdge, index) => {
          if (!isRecord(rawEdge)) return [];

          const { id, source, target } = rawEdge;
          if (typeof source !== "string" || typeof target !== "string") return [];

          return [
            {
              id: typeof id === "string" && id.length > 0 ? id : `e-${index + 1}`,
              source,
              target,
              type: "smoothstep",
              animated: true,
            },
          ];
        });

        setNodes(loadedNodes);
        setEdges(loadedEdges);
        setCurrentStrategyId(typeof payload.id === "string" ? payload.id : strategy.id);
        setCurrentStrategyName(strategy.name);
        setPendingPointerNodeType(null);
        window.requestAnimationFrame(() => {
          void fitView({ padding: 0.2, duration: 280 });
        });
      } catch {
        notifyError("Could not load this strategy graph. Please try another strategy.");
      } finally {
        setIsStrategyLoading(false);
      }
    },
    [fitView, notifyError, setEdges, setNodes]
  );

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
        style: { width: SANDBOX_NODE_WIDTH, color: "black" },
      };

      setNodes((nds) => nds.concat(newNode));
      if (nodes.length === 0) {
        setCurrentStrategyName(SANDBOX_DEFAULT_UNTITLED_STRATEGY_NAME);
        setCurrentStrategyId(null);
      }
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

  const onCreateStrategy = useCallback(() => {
    setCurrentStrategyId(null);
    setCurrentStrategyName(SANDBOX_DEFAULT_UNTITLED_STRATEGY_NAME);
    setPendingPointerNodeType(null);
  }, []);

  const onSaveStrategy = useCallback(async () => {
    if (nodes.length === 0) {
      notifyError("Add at least one node before saving a strategy.");
      return;
    }

    setIsStrategySaving(true);
    try {
      const strategyName = currentStrategyName ?? SANDBOX_DEFAULT_UNTITLED_STRATEGY_NAME;
      const strategyId = currentStrategyId ?? `s-${crypto.randomUUID()}`;

      const payload: BackendGraphDto = {
        id: strategyId,
        nodes: graphDatabase.nodes as unknown[],
        edges: graphDatabase.edges as unknown[],
      };

      const response = await fetch(SANDBOX_STRATEGIES_API.listStrategiesUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to save strategy (${response.status})`);
      }

      setCurrentStrategyId(strategyId);
      setCurrentStrategyName(strategyName);
    } catch {
      notifyError("Could not save strategy. Please try again.");
    } finally {
      setIsStrategySaving(false);
    }
  }, [currentStrategyId, currentStrategyName, graphDatabase, nodes.length, notifyError]);

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

      <div
        style={{
          width: 220,
          padding: 12,
          borderLeft: "1px solid #e5e7eb",
          fontFamily: "system-ui, sans-serif",
          boxSizing: "border-box",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Strategies</div>

          <div
            style={{
              marginBottom: 12,
              padding: "8px 10px",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              background: "#f9fafb",
            }}
          >
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Active</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
              {currentStrategyName ?? "No strategy loaded"}
            </div>
            {currentStrategyId && (
              <div style={{ marginTop: 2, fontSize: 11, color: "#6b7280" }}>ID: {currentStrategyId}</div>
            )}
          </div>

          {nodes.length === 0 ? (
            <>
              {isStrategiesLoading && (
                <div style={{ fontSize: 12, color: "#6b7280" }}>Loading previous strategies...</div>
              )}

              {!isStrategiesLoading && strategiesError && (
                <>
                  <div style={{ fontSize: 12, color: "#991b1b", marginBottom: 8 }}>{strategiesError}</div>
                  <button type="button" onClick={() => void fetchStrategies()} style={toolbarButtonStyle}>
                    Retry
                  </button>
                </>
              )}

              {!isStrategiesLoading && !strategiesError && strategies.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {strategies.map((strategy) => (
                    <button
                      key={strategy.id}
                      type="button"
                      onClick={() => void loadStrategy(strategy)}
                      disabled={isStrategyLoading}
                      style={{
                        ...strategyCardButtonStyle,
                        borderColor: currentStrategyId === strategy.id ? "#93c5fd" : "#e5e7eb",
                        background: currentStrategyId === strategy.id ? "#eff6ff" : "white",
                        opacity: isStrategyLoading ? 0.7 : 1,
                        cursor: isStrategyLoading ? "wait" : "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{strategy.name}</div>
                      <div style={{ marginTop: 4, fontSize: 11, color: "#6b7280" }}>
                        Last edited: {formatLastEdited(strategy.lastEdited)}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!isStrategiesLoading && !strategiesError && strategies.length === 0 && (
                <>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
                    No previous strategies found.
                  </div>
                  <button type="button" onClick={onCreateStrategy} style={toolbarButtonStyle}>
                    Create strategy
                  </button>
                </>
              )}

              {isStrategyLoading && (
                <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>Loading graph...</div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              This graph is ready. Add nodes or edges to continue editing.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void onSaveStrategy()}
          disabled={isStrategySaving}
          style={{
            ...toolbarButtonStyle,
            marginTop: 12,
            opacity: isStrategySaving ? 0.7 : 1,
            cursor: isStrategySaving ? "wait" : "pointer",
          }}
        >
          {isStrategySaving ? "Saving strategy..." : "Save strategy"}
        </button>
      </div>
    </div>
  );
}

const nodeTemplateWrapperStyle: React.CSSProperties = {
  width: SANDBOX_LIBRARY_NODE_WIDTH,
  marginBottom: 12,
  overflow: "visible",
};

const nodeTemplateDraggableStyle: React.CSSProperties = {
  width: "100%",
  cursor: "grab",
  userSelect: "none",
  WebkitUserSelect: "none",
};

const toolbarButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  background: "white",
  color: "#111827",
  fontSize: 12,
  fontWeight: 600,
  textAlign: "left",
};

const strategyCardButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  textAlign: "left",
  background: "white",
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
  ...NODE_HANDLE_STYLE,
};

const previewRightHandleStyle: React.CSSProperties = {
  position: "absolute",
  right: -8,
  top: "50%",
  transform: "translateY(-50%)",
  ...NODE_HANDLE_STYLE,
};

export default function Sandbox() {
  return (
    <ReactFlowProvider>
      <SandboxInner />
    </ReactFlowProvider>
  );
}
