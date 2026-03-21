import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  type Connection,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  createEmptyNodeRegistry,
  createNodeRegistry,
  type JsonScalar,
  type NodeData,
  type NodePaletteItem,
  type NodeRuntimeResult,
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
import { fetchNodeIoCatalog, testStrategy, type ApiError } from "../services/api";

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
  data: Record<string, JsonScalar>;
};

type GraphEdgePayload = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
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

function isApiError(value: unknown): value is ApiError {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    typeof value.message === "string" &&
    Array.isArray(value.details) &&
    value.details.every((detail) => typeof detail === "string")
  );
}

function stripRuntimeResults(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    if (!isRecord(node.data) || !("runtimeResult" in node.data)) {
      return node;
    }

    const { runtimeResult: _runtimeResult, ...rest } = node.data as NodeData;
    return {
      ...node,
      data: rest,
    };
  });
}

function mergeRuntimeResults(nodes: Node[], results: Record<string, NodeRuntimeResult>): Node[] {
  return nodes.map((node) => {
    const result = results[node.id];
    if (!result) return node;
    const nodeData = node.data as NodeData;
    return {
      ...node,
      data: {
        ...nodeData,
        runtimeResult: result,
      },
    };
  });
}

function formatLastEdited(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (isApiError(error)) {
    return error.details.length > 0
      ? `${error.message}\n${error.details.join("\n")}`
      : error.message;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

function NodeTemplatePreview({
  node,
  getDefaultNodeData,
  getNodeVisual,
}: {
  node: NodePaletteItem;
  getDefaultNodeData: (type: string) => NodeData | undefined;
  getNodeVisual: (type: string) => { accent: string; color: string } | undefined;
}) {
  const previewData = getDefaultNodeData(node.type);
  if (!previewData) return null;
  const visual = getNodeVisual(node.type) ?? {
    accent: "#16a34a",
    color: "white",
  };
  const fieldEntries = previewData.dataFields.map((field) => [field.name, previewData.fieldValues[field.name]]);
  const hasBody = fieldEntries.length > 0;

  return (
    <div
      style={{
        width: "100%",
        padding: 0,
        border: NODE_CARD_BORDER,
        borderRadius: NODE_CARD_RADIUS,
        background: visual.color,
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        boxSizing: "border-box",
        overflow: "hidden",
        color: "black",
      }}
    >
      {node.inputCount > 0 && <div style={previewLeftHandleStyle} />}
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
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {previewData.dataFields.map((field) => {
            const value = previewData.fieldValues[field.name];
            const isCheckbox = field.valueType === "BoolVal";

            return isCheckbox ? (
              <label
                key={field.name}
                style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, fontSize: 12 }}
              >
                <span>{field.name}</span>
                <input className="nodrag" type="checkbox" checked={Boolean(value)} readOnly disabled />
              </label>
            ) : (
              <input
                key={field.name}
                className="nodrag"
                readOnly
                disabled
                placeholder={field.name}
                value={typeof value === "string" || typeof value === "number" ? value : ""}
                type={field.valueType === "NumVal" ? "number" : "text"}
                style={previewInputStyle}
              />
            );
          })}
        </div>
      )}
      {node.outputCount > 0 && <div style={previewRightHandleStyle} />}
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
            whiteSpace: "pre-line",
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
  const [nodeRegistry, setNodeRegistry] = useState(() => createEmptyNodeRegistry());
  const [isNodeCatalogLoading, setIsNodeCatalogLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingPointerNodeType, setPendingPointerNodeType] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<StrategySummary[]>([]);
  const [isStrategiesLoading, setIsStrategiesLoading] = useState(false);
  const [strategiesError, setStrategiesError] = useState("");
  const [currentStrategyId, setCurrentStrategyId] = useState<string | null>(null);
  const [currentStrategyName, setCurrentStrategyName] = useState<string | null>(null);
  const [isStrategyLoading, setIsStrategyLoading] = useState(false);
  const [isStrategySaving, setIsStrategySaving] = useState(false);
  const [isStrategyTesting, setIsStrategyTesting] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const {
    nodePalette,
    nodeTypes,
    isSupportedNodeType,
    getDefaultNodeData,
    getNodeVisual,
  } = nodeRegistry;

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

  useEffect(() => {
    const abortController = new AbortController();

    const loadNodeCatalog = async () => {
      setIsNodeCatalogLoading(true);
      try {
        const catalog = await fetchNodeIoCatalog(abortController.signal);
        setNodeRegistry(createNodeRegistry(catalog));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        notifyError("Could not load node catalog from backend.");
      } finally {
        setIsNodeCatalogLoading(false);
      }
    };

    void loadNodeCatalog();
    return () => abortController.abort();
  }, [notifyError]);

  const initialNodes: Node[] = useMemo(() => [], []);
  const initialEdges: Edge[] = useMemo(() => [], []);

  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);

  const clearRuntimeResults = useCallback(() => {
    setNodes((currentNodes) => stripRuntimeResults(currentNodes));
  }, [setNodes]);

  const onNodesChange = useCallback(
    (changes: Parameters<typeof applyNodeChanges>[0]) => {
      setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
    },
    [setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: Parameters<typeof applyEdgeChanges>[0]) => {
      clearRuntimeResults();
      setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges));
    },
    [clearRuntimeResults, setEdges]
  );

  const graphDatabase = useMemo(() => {
    const minX = nodes.length > 0 ? Math.min(...nodes.map((node) => node.position.x)) : 0;
    const minY = nodes.length > 0 ? Math.min(...nodes.map((node) => node.position.y)) : 0;

    return {
      nodes: nodes.map((node) => {
        const fieldValues =
          node.data && typeof node.data === "object" && "fieldValues" in node.data
            ? ((node.data as { fieldValues?: Record<string, JsonScalar> }).fieldValues ?? {})
            : {};

        const data = Object.fromEntries(
          Object.entries(fieldValues).filter(([, value]) => value !== undefined)
        ) as Record<string, JsonScalar>;

        return {
          id: node.id,
          type: node.type ?? "unknown",
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
        sourceHandle: typeof edge.sourceHandle === "string" ? edge.sourceHandle : undefined,
        targetHandle: typeof edge.targetHandle === "string" ? edge.targetHandle : undefined,
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
    if (isNodeCatalogLoading) return;
    if (nodes.length > 0) return;

    const abortController = new AbortController();
    void fetchStrategies(abortController.signal);
    return () => {
      abortController.abort();
    };
  }, [fetchStrategies, isNodeCatalogLoading, nodes.length]);

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

          if (typeof id !== "string" || typeof type !== "string" || !finalPosition) {
            return [];
          }

          if (!isSupportedNodeType(type)) return [];

          const baseData = getDefaultNodeData(type);
          if (!baseData) return [];

          const mergedFieldValues = {
            ...(baseData.fieldValues ?? {}),
            ...(isRecord(data) ? (data as Record<string, JsonScalar>) : {}),
          };

          return [
            {
              id,
              type,
              position: finalPosition,
              data: {
                ...baseData,
                fieldValues: mergedFieldValues,
                runtimeResult: undefined,
              },
              style: { width: SANDBOX_NODE_WIDTH, color: "black" },
            },
          ];
        });

        const loadedEdges: Edge[] = payload.edges.flatMap((rawEdge, index) => {
          if (!isRecord(rawEdge)) return [];

          const { id, source, sourceHandle, target, targetHandle } = rawEdge;
          if (typeof source !== "string" || typeof target !== "string") return [];

          return [
            {
              id: typeof id === "string" && id.length > 0 ? id : `e-${index + 1}`,
              source,
              target,
              sourceHandle: typeof sourceHandle === "string" ? sourceHandle : undefined,
              targetHandle: typeof targetHandle === "string" ? targetHandle : undefined,
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
    [fitView, getDefaultNodeData, isSupportedNodeType, notifyError, setEdges, setNodes]
  );

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      clearRuntimeResults();
      setEdges((currentEdges) =>
        addEdge({ ...params, type: "smoothstep", animated: true }, currentEdges)
      );
    },
    [clearRuntimeResults, setEdges]
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

      const newNode: Node = {
        id: `n-${crypto.randomUUID()}`,
        type,
        position,
        data: nodeData,
        style: { width: SANDBOX_NODE_WIDTH, color: "black" },
      };

      setNodes((currentNodes) => stripRuntimeResults(currentNodes).concat(newNode));
      if (nodes.length === 0) {
        setCurrentStrategyName(SANDBOX_DEFAULT_UNTITLED_STRATEGY_NAME);
        setCurrentStrategyId(null);
      }
      return true;
    },
    [getDefaultNodeData, isSupportedNodeType, nodes.length, notifyError, setNodes]
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
    clearRuntimeResults();
  }, [clearRuntimeResults]);

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

  const onTestStrategy = useCallback(async () => {
    if (nodes.length === 0) {
      notifyError("Add at least one node before testing a strategy.");
      return;
    }

    setIsStrategyTesting(true);
    setNodes((currentNodes) => stripRuntimeResults(currentNodes));

    try {
      const payload: BackendGraphDto = {
        id: currentStrategyId ?? "draft",
        nodes: graphDatabase.nodes as unknown[],
        edges: graphDatabase.edges as unknown[],
      };

      const results = await testStrategy(payload);
      setNodes((currentNodes) => mergeRuntimeResults(stripRuntimeResults(currentNodes), results));
    } catch (error) {
      notifyError(
        formatApiErrorMessage(error, "Could not test this strategy. Please try again.")
      );
    } finally {
      setIsStrategyTesting(false);
    }
  }, [currentStrategyId, graphDatabase, nodes.length, notifyError, setNodes]);

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
              <NodeTemplatePreview
                node={node}
                getDefaultNodeData={getDefaultNodeData}
                getNodeVisual={getNodeVisual}
              />
            </div>
          </div>
        ))}

        <div style={{ marginTop: 16, fontSize: 12, color: "#6b7280" }}>
          {isNodeCatalogLoading ? "Loading node types..." : "Drag a node onto the canvas."}
          <br />
          {isNodeCatalogLoading
            ? "Node palette is populated from backend metadata."
            : "Ports and editable fields are generated from backend metadata."}
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

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            type="button"
            onClick={() => void onTestStrategy()}
            disabled={isStrategyTesting || nodes.length === 0}
            style={{
              ...toolbarButtonStyle,
              flex: 1,
              opacity: isStrategyTesting || nodes.length === 0 ? 0.7 : 1,
              cursor: isStrategyTesting ? "wait" : nodes.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            {isStrategyTesting ? "Testing..." : "Test strategy"}
          </button>

          <button
            type="button"
            onClick={() => void onSaveStrategy()}
            disabled={isStrategySaving}
            style={{
              ...toolbarButtonStyle,
              flex: 1,
              opacity: isStrategySaving ? 0.7 : 1,
              cursor: isStrategySaving ? "wait" : "pointer",
            }}
          >
            {isStrategySaving ? "Saving..." : "Save strategy"}
          </button>
        </div>
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
