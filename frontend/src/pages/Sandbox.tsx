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
  isMathNodeType,
  type JsonScalar,
  type NodeData,
  type NodePaletteItem,
  type NodeRuntimeResult,
} from "../components/nodes/NodeTypes";
import {
  NODE_HANDLE_STYLE,
  UI_ACCENT,
  UI_APP_SHELL,
  UI_BORDER_STRONG,
  UI_BORDER_SUBTLE,
  UI_CANVAS,
  UI_CARD,
  UI_ELEVATED,
  UI_PANEL,
  UI_TEXT_PRIMARY,
  UI_TEXT_SECONDARY,
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

type FrontendGraphPayload = {
  nodes: Node[];
  edges: Edge[];
};

const NODE_CATEGORY_ORDER = [
  "market data",
  "constant",
  "math",
  "comparison",
  "logic",
  "type conversion",
  "derived metric",
  "flow control",
] as const;

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

function buildBackendGraphPayload(graph: FrontendGraphPayload): GraphPayload {
  const minX = graph.nodes.length > 0 ? Math.min(...graph.nodes.map((node) => node.position.x)) : 0;
  const minY = graph.nodes.length > 0 ? Math.min(...graph.nodes.map((node) => node.position.y)) : 0;

  return {
    nodes: graph.nodes.map((node) => {
      const nodeData = node.data as NodeData;
      const data = Object.fromEntries(
        Object.entries(nodeData.fieldValues ?? {}).filter(([, value]) => value !== undefined)
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
    edges: graph.edges.map((edge, index) => ({
      id: edge.id || `e-${index + 1}`,
      source: edge.source,
      target: edge.target,
      sourceHandle: typeof edge.sourceHandle === "string" ? edge.sourceHandle : undefined,
      targetHandle: typeof edge.targetHandle === "string" ? edge.targetHandle : undefined,
    })),
  };
}

function materializeInlineMathInputs(nodes: Node[], edges: Edge[]): FrontendGraphPayload {
  const generatedNodes: Node[] = [];
  const generatedEdges: Edge[] = [];

  for (const node of nodes) {
    const nodeType = typeof node.type === "string" ? node.type : "";
    if (!isMathNodeType(nodeType)) continue;

    const nodeData = node.data as NodeData;
    const inlineInputValues = nodeData.inlineInputValues ?? {};
    const inputPorts = nodeData.inputs ?? [];

    for (const port of inputPorts) {
      const inlineValue = inlineInputValues[String(port.index)];
      if (typeof inlineValue !== "number") continue;

      const hasIncomingEdge = edges.some((edge) => {
        if (edge.target !== node.id) return false;
        if (edge.targetHandle === `in:${port.index}`) return true;
        return edge.targetHandle == null && inputPorts.length === 1 && port.index === 0;
      });

      if (hasIncomingEdge) continue;

      const generatedNodeId = `generated-inline-${node.id}-${port.index}`;
      generatedNodes.push({
        id: generatedNodeId,
        type: "const_number",
        position: {
          x: node.position.x - 180,
          y: node.position.y + port.index * 56,
        },
        data: {
          nodeType: "const_number",
          displayName: "Constant Number",
          nodeClass: "PRIMITIVE",
          theme: "const",
          inputs: [],
          outputs: [],
          dataFields: [],
          fieldValues: { value: inlineValue },
        } satisfies NodeData,
      });

      generatedEdges.push({
        id: `generated-inline-edge-${node.id}-${port.index}`,
        source: generatedNodeId,
        target: node.id,
        sourceHandle: "out:0",
        targetHandle: `in:${port.index}`,
        type: "smoothstep",
        animated: true,
      });
    }
  }

  return {
    nodes: nodes.concat(generatedNodes),
    edges: edges.concat(generatedEdges),
  };
}

function NodeTemplatePreview({
  node,
  getDefaultNodeData,
  getNodeVisual,
}: {
  node: NodePaletteItem;
  getDefaultNodeData: (type: string) => NodeData | undefined;
  getNodeVisual: (type: string) => {
    background: string;
    border: string;
    title: string;
    sub: string;
    handle: string;
    color: string;
    category: string;
    borderWidth: number;
  } | undefined;
}) {
  const previewData = getDefaultNodeData(node.type);
  if (!previewData) return null;
  const visual = getNodeVisual(node.type) ?? {
    background: UI_CARD,
    border: UI_ACCENT,
    title: UI_TEXT_PRIMARY,
    sub: UI_TEXT_SECONDARY,
    handle: UI_ACCENT,
    color: UI_CARD,
    category: "node",
    borderWidth: 1.5,
  };
  const hasBody = previewData.dataFields.length > 0;

  return (
    <div
      style={{
        width: "100%",
        padding: 0,
        border: `${visual.borderWidth}px solid ${visual.border}`,
        borderRadius: 10,
        background: visual.background,
        fontFamily: "monospace",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        boxSizing: "border-box",
        overflow: "hidden",
        color: UI_TEXT_PRIMARY,
        boxShadow: "0 8px 18px rgba(0, 0, 0, 0.2)",
        minWidth: 160,
      }}
    >
      {node.inputCount > 0 && <div style={previewLeftHandleStyle(visual.handle)} />}
      <div style={{ padding: "10px 14px 8px" }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: visual.title }}>{previewData.displayName}</div>
        <div
          style={{
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: visual.sub,
            marginTop: 1,
          }}
        >
          {visual.category}
        </div>
      </div>
      {hasBody && (
        <div style={{ padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
          {previewData.dataFields.map((field) => {
            const value = previewData.fieldValues[field.name];
            const isCheckbox = field.valueType === "BoolVal";

            return isCheckbox ? (
              <label
                key={field.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 11,
                  color: UI_TEXT_SECONDARY,
                }}
              >
                <input
                  className="nodrag"
                  type="checkbox"
                  checked={Boolean(value)}
                  readOnly
                  disabled
                  style={{ accentColor: visual.border, width: 14, height: 14, margin: 0 }}
                />
                <span>{field.name}</span>
              </label>
            ) : (
              <div key={field.name} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span
                  style={{
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: visual.sub,
                  }}
                >
                  {field.name}
                </span>
                <input
                  className="nodrag"
                  readOnly
                  disabled
                  placeholder={field.name}
                  value={typeof value === "string" || typeof value === "number" ? value : ""}
                  type={field.valueType === "NumVal" ? "number" : "text"}
                  style={previewInputStyle(visual.border)}
                />
              </div>
            );
          })}
        </div>
      )}
      {node.outputCount > 0 && <div style={previewRightHandleStyle(visual.handle)} />}
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
          background: UI_ELEVATED,
          border: `1px solid ${UI_BORDER_STRONG}`,
          boxShadow: "0 12px 30px rgba(0, 0, 0, 0.2)",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 26,
            height: 26,
            borderRadius: 999,
            background: withAlpha(UI_ACCENT, 0.18),
            color: UI_ACCENT,
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
            color: UI_TEXT_PRIMARY,
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

  const groupedNodePalette = useMemo(() => {
    const grouped = new Map<string, NodePaletteItem[]>();

    for (const node of nodePalette) {
      const category = getNodeVisual(node.type)?.category ?? "other";
      const existing = grouped.get(category);
      if (existing) {
        existing.push(node);
      } else {
        grouped.set(category, [node]);
      }
    }

    for (const nodesInCategory of grouped.values()) {
      nodesInCategory.sort((left, right) => left.label.localeCompare(right.label));
    }

    return [...grouped.entries()].sort(([leftCategory], [rightCategory]) => {
      const leftIndex = NODE_CATEGORY_ORDER.indexOf(leftCategory as (typeof NODE_CATEGORY_ORDER)[number]);
      const rightIndex = NODE_CATEGORY_ORDER.indexOf(rightCategory as (typeof NODE_CATEGORY_ORDER)[number]);

      const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
      const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

      if (normalizedLeft !== normalizedRight) {
        return normalizedLeft - normalizedRight;
      }

      return leftCategory.localeCompare(rightCategory);
    });
  }, [getNodeVisual, nodePalette]);

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
    return buildBackendGraphPayload({ nodes, edges });
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
              style: { width: SANDBOX_NODE_WIDTH, color: UI_TEXT_PRIMARY },
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
        style: { width: SANDBOX_NODE_WIDTH, color: UI_TEXT_PRIMARY },
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
      const materializedGraph = materializeInlineMathInputs(nodes, edges);
      const payloadGraph = buildBackendGraphPayload(materializedGraph);

      const payload: BackendGraphDto = {
        id: strategyId,
        nodes: payloadGraph.nodes as unknown[],
        edges: payloadGraph.edges as unknown[],
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
  }, [currentStrategyId, currentStrategyName, edges, nodes, nodes.length, notifyError]);

  const onTestStrategy = useCallback(async () => {
    if (nodes.length === 0) {
      notifyError("Add at least one node before testing a strategy.");
      return;
    }

    setIsStrategyTesting(true);
    setNodes((currentNodes) => stripRuntimeResults(currentNodes));

    try {
      const materializedGraph = materializeInlineMathInputs(nodes, edges);
      const payloadGraph = buildBackendGraphPayload(materializedGraph);

      const payload: BackendGraphDto = {
        id: currentStrategyId ?? "draft",
        nodes: payloadGraph.nodes as unknown[],
        edges: payloadGraph.edges as unknown[],
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
  }, [currentStrategyId, edges, nodes, nodes.length, notifyError, setNodes]);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        height: "100vh",
        width: "100vw",
        minHeight: 0,
        overflow: "hidden",
        background: UI_APP_SHELL,
        color: UI_TEXT_PRIMARY,
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

        .react-flow {
          background: ${UI_CANVAS};
        }

        .react-flow__background pattern line {
          stroke: ${UI_BORDER_SUBTLE};
        }

        .react-flow__controls {
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
          border: 1px solid ${UI_BORDER_SUBTLE};
          border-radius: 12px;
          overflow: hidden;
        }

        .react-flow__controls-button {
          background: ${UI_PANEL};
          border-bottom: 1px solid ${UI_BORDER_SUBTLE};
          color: ${UI_TEXT_PRIMARY};
        }

        .react-flow__controls-button:hover {
          background: ${UI_ELEVATED};
        }

        .react-flow__controls-button svg {
          fill: ${UI_TEXT_PRIMARY};
        }

        .react-flow__minimap {
          background: ${UI_PANEL};
          border: 1px solid ${UI_BORDER_SUBTLE};
          border-radius: 12px;
          overflow: hidden;
        }

        .react-flow__attribution {
          background: ${UI_PANEL} !important;
          color: ${UI_TEXT_SECONDARY} !important;
          border-top-left-radius: 8px;
        }

        .react-flow__attribution a {
          color: ${UI_ACCENT} !important;
        }

        .node-library-panel {
          scrollbar-width: thin;
          scrollbar-color: ${UI_BORDER_STRONG} transparent;
        }

        .node-library-panel::-webkit-scrollbar {
          width: 8px;
        }

        .node-library-panel::-webkit-scrollbar-track {
          background: transparent;
        }

        .node-library-panel::-webkit-scrollbar-thumb {
          background: ${UI_BORDER_STRONG};
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }

        .node-library-panel::-webkit-scrollbar-thumb:hover {
          background: ${UI_TEXT_SECONDARY};
          background-clip: padding-box;
        }

        .node-library-panel::-webkit-scrollbar-corner {
          background: transparent;
        }
      `}</style>

      {errorMessage && <ErrorNotification message={errorMessage} />}

      <div
        className="node-library-panel"
        style={{
          width: 220,
          padding: 12,
          borderRight: `1px solid ${UI_BORDER_SUBTLE}`,
          fontFamily: "system-ui, sans-serif",
          boxSizing: "border-box",
          height: "100%",
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          flexShrink: 0,
          background: UI_PANEL,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 10, color: UI_TEXT_PRIMARY }}>Nodes</div>

        {groupedNodePalette.map(([category, nodesInCategory]) => (
          <section key={category} style={{ marginBottom: 18 }}>
            <div
              style={{
                marginBottom: 10,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: UI_TEXT_SECONDARY,
              }}
            >
              {category}
            </div>

            {nodesInCategory.map((node) => (
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
          </section>
        ))}

        <div style={{ marginTop: 16, fontSize: 12, color: UI_TEXT_SECONDARY }}>
          {isNodeCatalogLoading ? "Loading node types..." : "Drag a node onto the canvas."}
          <br />
          {isNodeCatalogLoading
            ? "Node palette is populated from backend metadata."
            : "Ports and editable fields are generated from backend metadata."}
        </div>

        {pendingPointerNodeType && (
          <div style={{ marginTop: 8, fontSize: 12, color: UI_ACCENT }}>
            Touch mode: tap the canvas to place this node.
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 12, color: UI_TEXT_SECONDARY }}>Graph JSON</div>
        <pre
          style={{
            marginTop: 8,
            padding: 8,
            border: `1px solid ${UI_BORDER_SUBTLE}`,
            borderRadius: 8,
            background: UI_CARD,
            fontSize: 11,
            color: UI_TEXT_PRIMARY,
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
          <Background color={UI_BORDER_SUBTLE} gap={24} size={1.2} />
          <MiniMap
            nodeColor={UI_BORDER_STRONG}
            maskColor="rgba(10, 10, 15, 0.72)"
            style={{ background: UI_PANEL }}
          />
          <Controls />
        </ReactFlow>
      </div>

      <div
        style={{
          width: 220,
          padding: 12,
          borderLeft: `1px solid ${UI_BORDER_SUBTLE}`,
          fontFamily: "system-ui, sans-serif",
          boxSizing: "border-box",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
          flexShrink: 0,
          background: UI_PANEL,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, marginBottom: 10, color: UI_TEXT_PRIMARY }}>Strategies</div>

          <div
            style={{
              marginBottom: 12,
              padding: "8px 10px",
              border: `1px solid ${UI_BORDER_SUBTLE}`,
              borderRadius: 8,
              background: UI_CARD,
            }}
          >
            <div style={{ fontSize: 11, color: UI_TEXT_SECONDARY, marginBottom: 4 }}>Active</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: UI_TEXT_PRIMARY }}>
              {currentStrategyName ?? "No strategy loaded"}
            </div>
            {currentStrategyId && (
              <div style={{ marginTop: 2, fontSize: 11, color: UI_TEXT_SECONDARY }}>ID: {currentStrategyId}</div>
            )}
          </div>

          {nodes.length === 0 ? (
            <>
              {isStrategiesLoading && (
                <div style={{ fontSize: 12, color: UI_TEXT_SECONDARY }}>Loading previous strategies...</div>
              )}

              {!isStrategiesLoading && strategiesError && (
                <>
                  <div style={{ fontSize: 12, color: UI_ACCENT, marginBottom: 8 }}>{strategiesError}</div>
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
                        borderColor: currentStrategyId === strategy.id ? UI_BORDER_STRONG : UI_BORDER_SUBTLE,
                        background: currentStrategyId === strategy.id ? UI_ELEVATED : UI_CARD,
                        opacity: isStrategyLoading ? 0.7 : 1,
                        cursor: isStrategyLoading ? "wait" : "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, color: UI_TEXT_PRIMARY }}>{strategy.name}</div>
                      <div style={{ marginTop: 4, fontSize: 11, color: UI_TEXT_SECONDARY }}>
                        Last edited: {formatLastEdited(strategy.lastEdited)}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!isStrategiesLoading && !strategiesError && strategies.length === 0 && (
                <>
                  <div style={{ fontSize: 12, color: UI_TEXT_SECONDARY, marginBottom: 8 }}>
                    No previous strategies found.
                  </div>
                  <button type="button" onClick={onCreateStrategy} style={toolbarButtonStyle}>
                    Create strategy
                  </button>
                </>
              )}

              {isStrategyLoading && (
                <div style={{ marginTop: 10, fontSize: 12, color: UI_TEXT_SECONDARY }}>Loading graph...</div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 12, color: UI_TEXT_SECONDARY }}>
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
  border: `1px solid ${UI_BORDER_SUBTLE}`,
  borderRadius: 8,
  background: UI_CARD,
  color: UI_TEXT_PRIMARY,
  fontSize: 12,
  fontWeight: 600,
  textAlign: "left",
};

const strategyCardButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: `1px solid ${UI_BORDER_SUBTLE}`,
  borderRadius: 8,
  textAlign: "left",
  background: UI_CARD,
};

function previewInputStyle(borderColor: string): React.CSSProperties {
  return {
    flex: 1,
    minWidth: 0,
    border: "1px solid #2a2a3a",
    borderRadius: 6,
    padding: "6px 9px",
    fontSize: 11,
    lineHeight: 1.2,
    background: UI_CANVAS,
    color: UI_TEXT_SECONDARY,
    fontFamily: "monospace",
    boxShadow: `inset 0 0 0 1px ${borderColor}10`,
  };
}

function previewLeftHandleStyle(handleColor: string): React.CSSProperties {
  return {
    position: "absolute",
    left: -8,
    top: "50%",
    transform: "translateY(-50%)",
    ...NODE_HANDLE_STYLE,
    width: 10,
    height: 10,
    background: handleColor,
    border: "none",
  };
}

function previewRightHandleStyle(handleColor: string): React.CSSProperties {
  return {
    position: "absolute",
    right: -8,
    top: "50%",
    transform: "translateY(-50%)",
    ...NODE_HANDLE_STYLE,
    width: 10,
    height: 10,
    background: handleColor,
    border: "none",
  };
}

export default function Sandbox() {
  return (
    <ReactFlowProvider>
      <SandboxInner />
    </ReactFlowProvider>
  );
}
