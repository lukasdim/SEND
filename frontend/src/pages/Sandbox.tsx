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
  type NodeErrorState,
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

type PaletteDragState = {
  nodeType: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  overCanvas: boolean;
  flowPosition: {
    x: number;
    y: number;
  } | null;
  canvasZoom: number;
};

type SandboxIssue = {
  id: string;
  severity: "error" | "warning";
  title: string;
  summary: string;
  details: string[];
  technicalDetails: string[];
  nodeId?: string;
  portIndex?: number;
};

type TransientBanner = {
  title: string;
  summary: string;
  details?: string[];
};

const LIBRARY_PREVIEW_SCALE = SANDBOX_LIBRARY_NODE_WIDTH / SANDBOX_NODE_WIDTH;

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

function clearNodeIssues(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    if (!isRecord(node.data) || !("errorState" in node.data)) {
      return node;
    }

    const nodeData = node.data as NodeData;
    if (!nodeData.errorState) return node;
    return {
      ...node,
      data: {
        ...nodeData,
        errorState: undefined,
      },
    };
  });
}

function clearNodeIssueById(nodes: Node[], nodeId: string): Node[] {
  return nodes.map((node) => {
    if (node.id !== nodeId) return node;
    const nodeData = node.data as NodeData;
    if (!nodeData.errorState) return node;
    return {
      ...node,
      data: {
        ...nodeData,
        errorState: undefined,
      },
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

function formatFallbackErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  if (isApiError(error) && error.message.length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

function humanizePortName(portName: string | undefined, portIndex: number | undefined): string {
  if (portName && portName.trim().length > 0) {
    return portName.trim();
  }
  if (typeof portIndex === "number") {
    return `input ${portIndex + 1}`;
  }
  return "this input";
}

function toNodeErrorState(issue: SandboxIssue): NodeErrorState {
  return {
    severity: issue.severity,
    summary: issue.summary,
    details: issue.details,
    portIndex: issue.portIndex,
  };
}

function applyIssuesToNodes(nodes: Node[], issues: SandboxIssue[]): Node[] {
  const issueByNodeId = new Map<string, SandboxIssue[]>();
  for (const issue of issues) {
    if (!issue.nodeId) continue;
    const existing = issueByNodeId.get(issue.nodeId);
    if (existing) {
      existing.push(issue);
    } else {
      issueByNodeId.set(issue.nodeId, [issue]);
    }
  }

  return clearNodeIssues(nodes).map((node) => {
    const nodeIssues = issueByNodeId.get(node.id);
    if (!nodeIssues || nodeIssues.length === 0) return node;

    const primaryIssue = nodeIssues[0];
    const mergedDetails = [...new Set(nodeIssues.flatMap((issue) => issue.details))];
    const nodeData = node.data as NodeData;
    return {
      ...node,
      data: {
        ...nodeData,
        errorState: {
          ...toNodeErrorState(primaryIssue),
          details: mergedDetails,
        },
      },
    };
  });
}

function buildIssueFromDetail(detail: string, nodeById: Map<string, Node<NodeData>>): SandboxIssue | null {
  const missingInputMatch = detail.match(/Missing input value for node ([A-Za-z0-9-_]+) port (\d+)/i);
  if (missingInputMatch) {
    const [, nodeId, portIndexText] = missingInputMatch;
    const portIndex = Number(portIndexText);
    const node = nodeById.get(nodeId);
    if (!node) return null;
    const nodeData = node.data as NodeData;
    const port = nodeData.inputs.find((input) => input.index === portIndex);
    const portLabel = humanizePortName(port?.name, portIndex);
    const supportsFallback = isMathNodeType(nodeData.nodeType);
    return {
      id: `${nodeId}:${portIndex}:${detail}`,
      severity: "error",
      title: "Missing input",
      summary: `${nodeData.displayName} needs a value for ${portLabel}.`,
      details: supportsFallback
        ? [`Connect a value to ${portLabel}, or enter a fallback number directly in the node.`]
        : [`Connect a value to ${portLabel} before testing again.`],
      technicalDetails: [detail],
      nodeId,
      portIndex,
    };
  }

  const genericNodeMatch = detail.match(/node ([A-Za-z0-9-_]+)/i);
  if (genericNodeMatch) {
    const [, nodeId] = genericNodeMatch;
    const node = nodeById.get(nodeId);
    if (!node) return null;
    const nodeData = node.data as NodeData;
    return {
      id: `${nodeId}:${detail}`,
      severity: "error",
      title: "Node needs attention",
      summary: `${nodeData.displayName} needs attention before this strategy can run.`,
      details: ["Review the highlighted node and update its inputs or connections, then test again."],
      technicalDetails: [detail],
      nodeId,
    };
  }

  return null;
}

function normalizeStrategyIssues(error: unknown, nodes: Node[]): SandboxIssue[] {
  if (!isApiError(error)) return [];

  const nodeById = new Map(
    nodes.map((node) => [node.id, node as Node<NodeData>])
  );
  const rawMessages = [...error.details];
  if (rawMessages.length === 0 || !rawMessages.includes(error.message)) {
    rawMessages.unshift(error.message);
  }

  const issues: SandboxIssue[] = [];
  for (const rawMessage of rawMessages) {
    const issue = buildIssueFromDetail(rawMessage, nodeById);
    if (issue) {
      issues.push(issue);
    }
  }

  const deduped = new Map<string, SandboxIssue>();
  for (const issue of issues) {
    if (!deduped.has(issue.id)) {
      deduped.set(issue.id, issue);
    }
  }
  return [...deduped.values()];
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
      const inlineInputKey = String(port.index);
      if (!Object.prototype.hasOwnProperty.call(inlineInputValues, inlineInputKey)) continue;

      const inlineValue = inlineInputValues[inlineInputKey];
      if (typeof inlineValue !== "number" || Number.isNaN(inlineValue)) continue;

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

function ErrorBanner({
  issueCount,
  title,
  summary,
  details,
  technicalDetails,
  onJump,
  onPrevious,
  onNext,
  onDismiss,
}: {
  issueCount?: number;
  title: string;
  summary: string;
  details?: string[];
  technicalDetails?: string[];
  onJump?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onDismiss?: () => void;
}) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const hasIssueNavigation = issueCount !== undefined && issueCount > 1 && onPrevious && onNext;
  const hasTechnicalDetails = Boolean(technicalDetails && technicalDetails.length > 0);
  const hasDetails = Boolean(details && details.length > 0);

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
          gridTemplateColumns: "42px 1fr auto",
          alignItems: "start",
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
            display: "flex",
            flexDirection: "column",
            gap: 8,
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: UI_TEXT_SECONDARY,
                  marginBottom: 3,
                }}
              >
                {issueCount && issueCount > 1 ? `${issueCount} issues need attention` : title}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.35, wordBreak: "break-word" }}>{summary}</div>
            </div>
          </div>

          {hasDetails && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {details?.map((detail) => (
                <div key={detail} style={{ fontSize: 12, lineHeight: 1.35, color: UI_TEXT_SECONDARY }}>
                  {detail}
                </div>
              ))}
            </div>
          )}

          {(onJump || hasIssueNavigation || hasTechnicalDetails) && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", pointerEvents: "auto" }}>
              {onJump && (
                <button type="button" onClick={onJump} style={bannerButtonStyle}>
                  Jump to node
                </button>
              )}
              {hasIssueNavigation && (
                <>
                  <button type="button" onClick={onPrevious} style={bannerButtonStyle}>
                    Previous issue
                  </button>
                  <button type="button" onClick={onNext} style={bannerButtonStyle}>
                    Next issue
                  </button>
                </>
              )}
              {hasTechnicalDetails && (
                <button
                  type="button"
                  onClick={() => setShowTechnicalDetails((current) => !current)}
                  style={bannerButtonStyle}
                >
                  {showTechnicalDetails ? "Hide technical details" : "Technical details"}
                </button>
              )}
            </div>
          )}

          {showTechnicalDetails && hasTechnicalDetails && (
            <pre
              style={{
                margin: 0,
                padding: "10px 11px",
                borderRadius: 8,
                background: UI_CARD,
                border: `1px solid ${UI_BORDER_SUBTLE}`,
                color: UI_TEXT_SECONDARY,
                fontSize: 11,
                lineHeight: 1.35,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              {technicalDetails?.join("\n") ?? ""}
            </pre>
          )}
        </div>

        <div style={{ pointerEvents: "auto" }}>
          {onDismiss && (
            <button type="button" onClick={onDismiss} style={bannerDismissButtonStyle}>
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SandboxInner() {
  const { fitView, getZoom, screenToFlowPosition, setCenter } = useReactFlow();
  const [nodeRegistry, setNodeRegistry] = useState(() => createEmptyNodeRegistry());
  const [isNodeCatalogLoading, setIsNodeCatalogLoading] = useState(true);
  const [activeIssues, setActiveIssues] = useState<SandboxIssue[]>([]);
  const [focusedIssueIndex, setFocusedIssueIndex] = useState(0);
  const [transientBanner, setTransientBanner] = useState<TransientBanner | null>(null);
  const [paletteDrag, setPaletteDrag] = useState<PaletteDragState | null>(null);
  const [strategies, setStrategies] = useState<StrategySummary[]>([]);
  const [isStrategiesLoading, setIsStrategiesLoading] = useState(false);
  const [strategiesError, setStrategiesError] = useState("");
  const [currentStrategyId, setCurrentStrategyId] = useState<string | null>(null);
  const [currentStrategyName, setCurrentStrategyName] = useState<string | null>(null);
  const [isStrategyLoading, setIsStrategyLoading] = useState(false);
  const [isStrategySaving, setIsStrategySaving] = useState(false);
  const [isStrategyTesting, setIsStrategyTesting] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);

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

  const nodePaletteByType = useMemo(
    () => new Map(nodePalette.map((node) => [node.type, node])),
    [nodePalette]
  );

  const initialNodes: Node[] = useMemo(() => [], []);
  const initialEdges: Edge[] = useMemo(() => [], []);

  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);

  const dismissTransientBanner = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setTransientBanner(null);
  }, []);

  const notifyTransientBanner = useCallback((title: string, summary: string, details?: string[]) => {
    dismissTransientBanner();

    setTransientBanner({ title, summary, details });
    timeoutRef.current = window.setTimeout(() => {
      dismissTransientBanner();
    }, SANDBOX_NOTIFICATION_TIMEOUT_MS);
  }, [dismissTransientBanner]);

  const dismissIssues = useCallback(() => {
    setActiveIssues([]);
    setFocusedIssueIndex(0);
    setNodes((currentNodes) => clearNodeIssues(currentNodes));
  }, [setNodes]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setActiveIssues((currentIssues) => {
      if (currentIssues.length === 0) return currentIssues;
      const issueKeys = new Set(
        nodes.flatMap((node) => {
          const nodeData = node.data as NodeData;
          if (!nodeData.errorState) return [];
          return [`${node.id}:${nodeData.errorState.summary}`];
        })
      );

      const nextIssues = currentIssues.filter((issue) => {
        if (!issue.nodeId) return true;
        return issueKeys.has(`${issue.nodeId}:${issue.summary}`);
      });

      return nextIssues.length === currentIssues.length ? currentIssues : nextIssues;
    });
  }, [nodes]);

  useEffect(() => {
    if (activeIssues.length === 0 && focusedIssueIndex !== 0) {
      setFocusedIssueIndex(0);
      return;
    }

    if (focusedIssueIndex >= activeIssues.length && activeIssues.length > 0) {
      setFocusedIssueIndex(activeIssues.length - 1);
    }
  }, [activeIssues.length, focusedIssueIndex]);

  useEffect(() => {
    const abortController = new AbortController();

    const loadNodeCatalog = async () => {
      setIsNodeCatalogLoading(true);
      try {
        const catalog = await fetchNodeIoCatalog(abortController.signal);
        setNodeRegistry(createNodeRegistry(catalog));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        notifyTransientBanner(
          "Could not load node catalog",
          "The node library could not be loaded from the backend.",
          ["Refresh the page or verify the backend is running."]
        );
      } finally {
        setIsNodeCatalogLoading(false);
      }
    };

    void loadNodeCatalog();
    return () => abortController.abort();
  }, [notifyTransientBanner]);

  const clearRuntimeResults = useCallback(() => {
    setNodes((currentNodes) => stripRuntimeResults(currentNodes));
  }, [setNodes]);

  const clearIssueForNode = useCallback(
    (nodeId: string) => {
      setNodes((currentNodes) => clearNodeIssueById(currentNodes, nodeId));
      setActiveIssues((currentIssues) => currentIssues.filter((issue) => issue.nodeId !== nodeId));
    },
    [setNodes]
  );

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

  const focusedIssue = activeIssues[focusedIssueIndex];
  const currentBanner =
    activeIssues.length > 0
      ? focusedIssue
        ? {
            issueCount: activeIssues.length,
            title: focusedIssue.title,
            summary: focusedIssue.summary,
            details: focusedIssue.details,
            technicalDetails: focusedIssue.technicalDetails,
            onDismiss: dismissIssues,
          }
        : null
      : transientBanner
        ? {
            title: transientBanner.title,
            summary: transientBanner.summary,
            details: transientBanner.details,
            onDismiss: dismissTransientBanner,
          }
        : null;

  const focusIssue = useCallback(
    (issue: SandboxIssue | undefined) => {
      if (!issue?.nodeId) return;
      const node = nodes.find((candidate) => candidate.id === issue.nodeId);
      if (!node) return;

      setNodes((currentNodes) =>
        currentNodes.map((candidate) => ({
          ...candidate,
          selected: candidate.id === issue.nodeId,
        }))
      );
      void setCenter(node.position.x, node.position.y, { zoom: 1.15, duration: 280 });
    },
    [nodes, setCenter, setNodes]
  );

  const focusIssueByIndex = useCallback(
    (index: number) => {
      const normalizedIndex = ((index % activeIssues.length) + activeIssues.length) % activeIssues.length;
      setFocusedIssueIndex(normalizedIndex);
      focusIssue(activeIssues[normalizedIndex]);
    },
    [activeIssues, focusIssue]
  );

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
        notifyTransientBanner(
          "Could not load strategies",
          "Previous strategies are unavailable right now.",
          ["Use Retry, or check the backend connection and try again."]
        );
      } finally {
        setIsStrategiesLoading(false);
      }
    },
    [notifyTransientBanner]
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
        setActiveIssues([]);
        setFocusedIssueIndex(0);
        setCurrentStrategyId(typeof payload.id === "string" ? payload.id : strategy.id);
        setCurrentStrategyName(strategy.name);
        setPaletteDrag(null);
        dismissTransientBanner();
        window.requestAnimationFrame(() => {
          void fitView({ padding: 0.2, duration: 280 });
        });
      } catch {
        notifyTransientBanner(
          "Could not load strategy",
          "This strategy graph could not be opened.",
          ["Try another strategy or retry after the backend is available."]
        );
      } finally {
        setIsStrategyLoading(false);
      }
    },
    [dismissTransientBanner, fitView, getDefaultNodeData, isSupportedNodeType, notifyTransientBanner, setEdges, setNodes]
  );

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      clearRuntimeResults();
      if (typeof params.target === "string") {
        clearIssueForNode(params.target);
      }
      setEdges((currentEdges) =>
        addEdge({ ...params, type: "smoothstep", animated: true }, currentEdges)
      );
    },
    [clearIssueForNode, clearRuntimeResults, setEdges]
  );

  const tryCreateNode = useCallback(
    (type: string, position: { x: number; y: number }) => {
      if (!isSupportedNodeType(type)) {
        notifyTransientBanner(
          "Unsupported node",
          "That node type is not available in this workspace.",
          ["Drag a node from the sidebar and try again."]
        );
        return false;
      }

      const nodeData = getDefaultNodeData(type);
      if (!nodeData) {
        notifyTransientBanner(
          "Node configuration missing",
          "This node could not be created because its configuration is unavailable.",
          ["Refresh the page and try again."]
        );
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
    [getDefaultNodeData, isSupportedNodeType, nodes.length, notifyTransientBanner, setNodes]
  );

  const resolveCanvasDragState = useCallback(
    (nodeType: string, pointerId: number, clientX: number, clientY: number): PaletteDragState => {
      const canvasBounds = canvasWrapperRef.current?.getBoundingClientRect();
      const overCanvas = Boolean(
        canvasBounds &&
          clientX >= canvasBounds.left &&
          clientX <= canvasBounds.right &&
          clientY >= canvasBounds.top &&
          clientY <= canvasBounds.bottom
      );

      return {
        nodeType,
        pointerId,
        clientX,
        clientY,
        overCanvas,
        flowPosition: overCanvas
          ? screenToFlowPosition({
              x: clientX,
              y: clientY,
            })
          : null,
        canvasZoom: overCanvas ? getZoom() : 1,
      };
    },
    [getZoom, screenToFlowPosition]
  );

  const onTemplatePointerDown = useCallback(
    (event: React.PointerEvent, nodeType: string) => {
      if (event.button !== 0) return;
      event.preventDefault();
      setPaletteDrag(resolveCanvasDragState(nodeType, event.pointerId, event.clientX, event.clientY));
    },
    [resolveCanvasDragState]
  );

  useEffect(() => {
    if (!paletteDrag) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== paletteDrag.pointerId) return;
      event.preventDefault();
      setPaletteDrag(resolveCanvasDragState(paletteDrag.nodeType, event.pointerId, event.clientX, event.clientY));
    };

    const finishDrag = (event: PointerEvent) => {
      if (event.pointerId !== paletteDrag.pointerId) return;
      event.preventDefault();

      const finalDragState = resolveCanvasDragState(
        paletteDrag.nodeType,
        event.pointerId,
        event.clientX,
        event.clientY
      );

      if (finalDragState.overCanvas && finalDragState.flowPosition) {
        tryCreateNode(finalDragState.nodeType, finalDragState.flowPosition);
      }

      setPaletteDrag(null);
    };

    const cancelDrag = () => {
      setPaletteDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", finishDrag, { passive: false });
    window.addEventListener("pointercancel", cancelDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", cancelDrag);
    };
  }, [paletteDrag, resolveCanvasDragState, tryCreateNode]);

  const onCreateStrategy = useCallback(() => {
    setCurrentStrategyId(null);
    setCurrentStrategyName(SANDBOX_DEFAULT_UNTITLED_STRATEGY_NAME);
    setPaletteDrag(null);
    setActiveIssues([]);
    setFocusedIssueIndex(0);
    dismissTransientBanner();
    setNodes((currentNodes) => clearNodeIssues(stripRuntimeResults(currentNodes)));
  }, [dismissTransientBanner, setNodes]);

  const onSaveStrategy = useCallback(async () => {
    if (nodes.length === 0) {
      notifyTransientBanner(
        "Nothing to save",
        "Add at least one node before saving this strategy."
      );
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
      notifyTransientBanner(
        "Could not save strategy",
        "The strategy could not be saved right now.",
        ["Try again after the backend is available."]
      );
    } finally {
      setIsStrategySaving(false);
    }
  }, [currentStrategyId, currentStrategyName, edges, nodes, nodes.length, notifyTransientBanner]);

  const onTestStrategy = useCallback(async () => {
    if (nodes.length === 0) {
      notifyTransientBanner(
        "Nothing to test",
        "Add at least one node before testing this strategy."
      );
      return;
    }

    setIsStrategyTesting(true);
    dismissTransientBanner();
    setActiveIssues([]);
    setFocusedIssueIndex(0);
    setNodes((currentNodes) => clearNodeIssues(stripRuntimeResults(currentNodes)));

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
      setActiveIssues([]);
      setFocusedIssueIndex(0);
    } catch (error) {
      const issues = normalizeStrategyIssues(error, nodes);
      if (issues.length > 0) {
        setActiveIssues(issues);
        setFocusedIssueIndex(0);
        setNodes((currentNodes) => applyIssuesToNodes(currentNodes, issues));
        window.requestAnimationFrame(() => {
          focusIssue(issues[0]);
        });
      } else {
        notifyTransientBanner(
          "Could not test strategy",
          formatFallbackErrorMessage(error, "The strategy test failed. Review the graph and try again."),
          isApiError(error) ? error.details : undefined
        );
      }
    } finally {
      setIsStrategyTesting(false);
    }
  }, [
    currentStrategyId,
    dismissTransientBanner,
    edges,
    focusIssue,
    nodes,
    nodes.length,
    notifyTransientBanner,
    setNodes,
  ]);

  const activeDraggedNode = paletteDrag ? nodePaletteByType.get(paletteDrag.nodeType) : undefined;
  const paletteGhostWidth = SANDBOX_NODE_WIDTH;
  const paletteGhostScale = paletteDrag
    ? paletteDrag.overCanvas
      ? paletteDrag.canvasZoom
      : LIBRARY_PREVIEW_SCALE
    : 1;

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

      {currentBanner && (
        <ErrorBanner
          issueCount={"issueCount" in currentBanner ? currentBanner.issueCount : undefined}
          title={currentBanner.title}
          summary={currentBanner.summary}
          details={currentBanner.details}
          technicalDetails={"technicalDetails" in currentBanner ? currentBanner.technicalDetails : undefined}
          onJump={focusedIssue?.nodeId ? () => focusIssue(focusedIssue) : undefined}
          onPrevious={activeIssues.length > 1 ? () => focusIssueByIndex(focusedIssueIndex - 1) : undefined}
          onNext={activeIssues.length > 1 ? () => focusIssueByIndex(focusedIssueIndex + 1) : undefined}
          onDismiss={currentBanner.onDismiss}
        />
      )}

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
                  onPointerDown={(e) => onTemplatePointerDown(e, node.type)}
                  style={{
                    ...nodeTemplateDraggableStyle,
                    opacity: paletteDrag?.nodeType === node.type ? 0.35 : 1,
                  }}
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

      <div ref={canvasWrapperRef} style={{ flex: 1, minHeight: 0, height: "100%", width: "100%" }}>
        <ReactFlow
          nodeTypes={nodeTypes}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
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

      {paletteDrag && activeDraggedNode && (
        <div
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            width: paletteGhostWidth,
            transform: `translate(${paletteDrag.clientX}px, ${paletteDrag.clientY}px) translate(-50%, -50%) scale(${paletteGhostScale})`,
            transformOrigin: "center center",
            pointerEvents: "none",
            zIndex: 40,
            opacity: paletteDrag.overCanvas ? 0.94 : 0.82,
            transition: "width 140ms ease, opacity 140ms ease, transform 40ms linear",
            filter: paletteDrag.overCanvas
              ? "drop-shadow(0 18px 30px rgba(0, 0, 0, 0.34))"
              : "drop-shadow(0 10px 22px rgba(0, 0, 0, 0.22))",
          }}
        >
          <NodeTemplatePreview
            node={activeDraggedNode}
            getDefaultNodeData={getDefaultNodeData}
            getNodeVisual={getNodeVisual}
          />
        </div>
      )}

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
  touchAction: "none",
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

const bannerButtonStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: `1px solid ${UI_BORDER_SUBTLE}`,
  background: UI_CARD,
  color: UI_TEXT_PRIMARY,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const bannerDismissButtonStyle: React.CSSProperties = {
  ...bannerButtonStyle,
  minWidth: 78,
  textAlign: "center",
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
