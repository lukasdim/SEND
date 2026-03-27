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
  type NodeIssueSeverity,
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
import {
  fetchNodeIoCatalog,
  simulateStrategy,
  type ApiError,
  type StrategySimulationConfig,
  type StrategySimulationResult,
  type StrategySimulationTraceDay,
  type StrategySimulationTradeEvent,
} from "../services/api";

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

type ReplayGraphSnapshot = {
  nodes: Node<NodeData>[];
  edges: Edge[];
};

type ReplayMode = "edit" | "replay";

type ReplayDayStatus = "normal" | "warning" | "error";

type ReplayPosition = {
  ticker: string;
  quantity: number;
  averageCost: number;
};

type ReplayDayModel = {
  index: number;
  date: string;
  status: ReplayDayStatus;
  runtimeResults: Record<string, NodeRuntimeResult>;
  changedNodeIds: Set<string>;
  changedNodeCount: number;
  changedOutputCount: number;
  trace: StrategySimulationTraceDay;
  positions: ReplayPosition[];
  previewLines: string[];
};

type ReplaySession = {
  graphSnapshot: ReplayGraphSnapshot;
  graphSignature: string;
  result: StrategySimulationResult;
  replayDays: ReplayDayModel[];
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

function toUtcDate(value: string): Date {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addUtcDays(date: Date, days: number): Date {
  const nextDate = new Date(date.getTime());
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function addUtcMonths(date: Date, months: number): Date {
  const nextDate = new Date(date.getTime());
  const targetDay = nextDate.getUTCDate();
  nextDate.setUTCDate(1);
  nextDate.setUTCMonth(nextDate.getUTCMonth() + months);
  const lastDayOfTargetMonth = new Date(
    Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth() + 1, 0)
  ).getUTCDate();
  nextDate.setUTCDate(Math.min(targetDay, lastDayOfTargetMonth));
  return nextDate;
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function isWeekendIsoDate(value: string): boolean {
  return isWeekendDate(toUtcDate(value));
}

function isWeekendDate(date: Date): boolean {
  const weekday = date.getUTCDay();
  return weekday === 0 || weekday === 6;
}

function clampToWeekday(date: Date, direction: -1 | 1): Date {
  let nextDate = new Date(date.getTime());
  while (isWeekendDate(nextDate)) {
    nextDate = addUtcDays(nextDate, direction);
  }
  return nextDate;
}

function formatDisplayDate(value: string): string {
  return toUtcDate(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDisplayMonth(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatShortWeekday(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    timeZone: "UTC",
  });
}

function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function formatSignedCurrency(value: number): string {
  const formatted = formatCurrency(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatCurrency(0);
}

function formatSignedNumber(value: number): string {
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  if (value > 0) return `+${formatted}`;
  return formatted;
}

function getLatestWeekday(): string {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  return formatIsoDate(clampToWeekday(todayUtc, -1));
}

function buildDefaultSimulationConfig(): StrategySimulationConfig {
  const endDate = getLatestWeekday();
  const defaultStart = clampToWeekday(addUtcDays(toUtcDate(endDate), -30), -1);
  return {
    startDate: formatIsoDate(defaultStart),
    endDate,
    initialCash: 10000,
    includeTrace: true,
  };
}

function adjustSimulationRange(config: StrategySimulationConfig): StrategySimulationConfig {
  let startDate = isWeekendIsoDate(config.startDate)
    ? formatIsoDate(clampToWeekday(toUtcDate(config.startDate), -1))
    : config.startDate;
  let endDate = isWeekendIsoDate(config.endDate)
    ? formatIsoDate(clampToWeekday(toUtcDate(config.endDate), -1))
    : config.endDate;

  if (toUtcDate(endDate).getTime() < toUtcDate(startDate).getTime()) {
    endDate = startDate;
  }

  const maxEndDate = formatIsoDate(clampToWeekday(addUtcMonths(toUtcDate(startDate), 6), -1));
  if (toUtcDate(endDate).getTime() > toUtcDate(maxEndDate).getTime()) {
    endDate = maxEndDate;
  }

  return {
    ...config,
    startDate,
    endDate,
  };
}

function validateSimulationConfig(config: StrategySimulationConfig): string | null {
  if (!config.startDate || !config.endDate) {
    return "Choose a start and end date before running the simulation.";
  }
  if (isWeekendIsoDate(config.startDate) || isWeekendIsoDate(config.endDate)) {
    return "Start and end dates must be weekdays.";
  }
  if (toUtcDate(config.endDate).getTime() < toUtcDate(config.startDate).getTime()) {
    return "End date must be on or after the start date.";
  }
  if (toUtcDate(config.endDate).getTime() > addUtcMonths(toUtcDate(config.startDate), 6).getTime()) {
    return "Simulations are limited to a maximum six-month range right now.";
  }
  if (!Number.isFinite(config.initialCash) || config.initialCash < 0) {
    return "Initial cash must be a non-negative number.";
  }
  return null;
}

function stripRuntimeResults(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    if (!isRecord(node.data) || (!("runtimeResult" in node.data) && !("runtimeResultMeta" in node.data))) {
      return node;
    }

    const {
      runtimeResult: _runtimeResult,
      runtimeResultMeta: _runtimeResultMeta,
      ...rest
    } = node.data as NodeData;
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

function cloneReplayGraphSnapshot(graph: FrontendGraphPayload): ReplayGraphSnapshot {
  return {
    nodes: graph.nodes.map((node) => {
      const nodeData = node.data as NodeData;
      return {
        ...node,
        selected: false,
        data: {
          ...nodeData,
          runtimeResult: undefined,
          runtimeResultMeta: undefined,
          errorState: undefined,
          readOnly: true,
        },
      } as Node<NodeData>;
    }),
    edges: graph.edges.map((edge) => ({
      ...edge,
      selected: false,
    })),
  };
}

function serializeGraphSignature(graph: FrontendGraphPayload): string {
  return JSON.stringify(buildBackendGraphPayload(graph));
}

function summarizeOutputValue(value: JsonScalar): string {
  if (typeof value === "number") {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (value === null) {
    return "null";
  }
  return String(value);
}

function createReplayPreviewLines(
  traceDay: StrategySimulationTraceDay,
  nodeNameById: Map<string, string>
): string[] {
  const nextLines: string[] = [];

  for (const nodeChange of traceDay.nodeChanges) {
    const outputEntries = Object.entries(nodeChange.outputs);
    if (outputEntries.length === 0) continue;
    const [firstOutputKey, firstOutputValue] = outputEntries[0];
    const nodeLabel = nodeNameById.get(nodeChange.nodeId) ?? nodeChange.nodeId;
    nextLines.push(`${nodeLabel}: ${firstOutputKey} = ${summarizeOutputValue(firstOutputValue)}`);
    if (nextLines.length >= 4) break;
  }

  if (nextLines.length === 0 && traceDay.trades.length > 0) {
    for (const trade of traceDay.trades.slice(0, 4)) {
      nextLines.push(
        `${trade.action.toUpperCase()} ${trade.ticker}: ${formatSignedNumber(trade.filledShares)} @ ${formatCurrency(trade.fillPrice)}`
      );
    }
  }

  if (nextLines.length === 0 && traceDay.errors.length > 0) {
    return traceDay.errors.slice(0, 3);
  }

  if (nextLines.length === 0 && traceDay.warnings.length > 0) {
    return traceDay.warnings.slice(0, 3);
  }

  if (nextLines.length === 0) {
    return ["No node output values changed from the previous day."];
  }

  return nextLines;
}

function applyTradeToReplayPositions(
  positionsByTicker: Map<string, ReplayPosition>,
  trade: StrategySimulationTradeEvent
): void {
  const action = trade.action.toLowerCase();
  const existing = positionsByTicker.get(trade.ticker);

  if (action === "buy") {
    const existingQuantity = existing?.quantity ?? 0;
    const existingAverageCost = existing?.averageCost ?? 0;
    const nextQuantity = existingQuantity + trade.filledShares;
    const nextAverageCost =
      nextQuantity <= 0
        ? trade.fillPrice
        : ((existingQuantity * existingAverageCost) + trade.filledShares * trade.fillPrice) / nextQuantity;

    positionsByTicker.set(trade.ticker, {
      ticker: trade.ticker,
      quantity: nextQuantity,
      averageCost: nextAverageCost,
    });
    return;
  }

  if (action === "sell" && existing) {
    const nextQuantity = Math.max(0, existing.quantity - trade.filledShares);
    if (nextQuantity <= 0.0000001) {
      positionsByTicker.delete(trade.ticker);
      return;
    }

    positionsByTicker.set(trade.ticker, {
      ...existing,
      quantity: nextQuantity,
    });
  }
}

function sortReplayPositions(positions: ReplayPosition[]): ReplayPosition[] {
  return [...positions].sort((left, right) => left.ticker.localeCompare(right.ticker));
}

function buildReplayDays(
  result: StrategySimulationResult,
  graphSnapshot: ReplayGraphSnapshot
): ReplayDayModel[] {
  const nodeNameById = new Map(
    graphSnapshot.nodes.map((node) => [node.id, (node.data as NodeData).displayName ?? node.id])
  );
  const cumulativeRuntimeResults: Record<string, NodeRuntimeResult> = {};
  const positionsByTicker = new Map<string, ReplayPosition>();

  return result.trace.map((traceDay, index) => {
    const changedNodeIds = new Set<string>();
    let changedOutputCount = 0;

    for (const nodeChange of traceDay.nodeChanges) {
      changedNodeIds.add(nodeChange.nodeId);
      cumulativeRuntimeResults[nodeChange.nodeId] = {
        ...(cumulativeRuntimeResults[nodeChange.nodeId] ?? {}),
        ...nodeChange.outputs,
      };
      changedOutputCount += Object.keys(nodeChange.outputs).length;
    }

    for (const trade of traceDay.trades) {
      applyTradeToReplayPositions(positionsByTicker, trade);
    }

    const runtimeResults = Object.fromEntries(
      Object.entries(cumulativeRuntimeResults).map(([nodeId, outputs]) => [nodeId, { ...outputs }])
    );

    return {
      index,
      date: traceDay.date,
      status:
        traceDay.errors.length > 0
          ? "error"
          : traceDay.warnings.length > 0
            ? "warning"
            : "normal",
      runtimeResults,
      changedNodeIds,
      changedNodeCount: changedNodeIds.size,
      changedOutputCount,
      trace: traceDay,
      positions: sortReplayPositions([...positionsByTicker.values()]),
      previewLines: createReplayPreviewLines(traceDay, nodeNameById),
    };
  });
}

function stripReplayIssuePrefix(message: string): string {
  const warningPrefixMatch = message.match(/^\d{4}-\d{2}-\d{2} \[[^\]]+\] (.+)$/);
  if (warningPrefixMatch) {
    return warningPrefixMatch[1] ?? message;
  }

  return message;
}

function extractReplayIssueNodeId(message: string): string | null {
  const warningMatch = message.match(/^\d{4}-\d{2}-\d{2} \[([^\]]+)\]/);
  if (warningMatch?.[1]) {
    return warningMatch[1];
  }

  const engineMatch = message.match(/\bnode ([^:\s]+)(?::|\b)/i);
  if (engineMatch?.[1]) {
    return engineMatch[1];
  }

  return null;
}

function buildReplayNodeIssueMap(traceDay: StrategySimulationTraceDay): Map<string, NodeErrorState> {
  const issuesByNodeId = new Map<
    string,
    {
      severity: NodeIssueSeverity;
      summary: string;
      details: string[];
    }
  >();

  const registerIssue = (severity: NodeIssueSeverity, rawMessage: string) => {
    const nodeId = extractReplayIssueNodeId(rawMessage);
    if (!nodeId) return;

    const cleanedMessage = stripReplayIssuePrefix(rawMessage);
    const existing = issuesByNodeId.get(nodeId);
    if (!existing) {
      issuesByNodeId.set(nodeId, {
        severity,
        summary: cleanedMessage,
        details: [cleanedMessage],
      });
      return;
    }

    const nextSeverity = existing.severity === "error" || severity === "error" ? "error" : "warning";
    const nextDetails = existing.details.includes(cleanedMessage)
      ? existing.details
      : [...existing.details, cleanedMessage];

    issuesByNodeId.set(nodeId, {
      severity: nextSeverity,
      summary: existing.severity === "error" ? existing.summary : cleanedMessage,
      details: nextDetails,
    });
  };

  for (const warning of traceDay.warnings) {
    registerIssue("warning", warning);
  }

  for (const error of traceDay.errors) {
    registerIssue("error", error);
  }

  return new Map(
    [...issuesByNodeId.entries()].map(([nodeId, issue]) => [
      nodeId,
      {
        severity: issue.severity,
        summary: issue.summary,
        details: issue.details,
      } satisfies NodeErrorState,
    ])
  );
}

function estimateReplayNodeHeight(node: Node<NodeData>): number {
  const nodeData = node.data as NodeData;
  let height = 92;

  if ((nodeData.dataFields?.length ?? 0) > 0) {
    height += nodeData.dataFields.length * 50;
  }

  if (isMathNodeType(nodeData.nodeType) && (nodeData.inputs?.length ?? 0) > 0) {
    height += nodeData.inputs.length * 42;
  }

  if (nodeData.errorState) {
    height += 94 + (nodeData.errorState.details?.length ?? 0) * 18;
  }

  if (nodeData.runtimeResult && Object.keys(nodeData.runtimeResult).length > 0) {
    const runtimeLineCount = JSON.stringify(nodeData.runtimeResult, null, 2).split("\n").length;
    height += 78 + runtimeLineCount * 14;
  }

  return height;
}

function applyReplayNodeSpacing(nodes: Node<NodeData>[]): Node<NodeData>[] {
  const horizontalPadding = 24;
  const verticalPadding = 28;
  const estimatedWidth = 232;
  const halfWidth = estimatedWidth / 2;
  const placedBoxes: Array<{ left: number; right: number; top: number; bottom: number }> = [];
  const positionedNodes = new Map<string, Node<NodeData>>();

  const sortedNodes = [...nodes].sort((left, right) =>
    left.position.y === right.position.y ? left.position.x - right.position.x : left.position.y - right.position.y
  );

  for (const node of sortedNodes) {
    const height = estimateReplayNodeHeight(node);
    let y = node.position.y;
    let top = y - height / 2;
    let bottom = y + height / 2;
    const left = node.position.x - halfWidth;
    const right = node.position.x + halfWidth;
    let hasOverlap = true;

    while (hasOverlap) {
      hasOverlap = false;

      for (const box of placedBoxes) {
        const overlapsHorizontally = left < box.right + horizontalPadding && right > box.left - horizontalPadding;
        const overlapsVertically = top < box.bottom + verticalPadding && bottom > box.top - verticalPadding;

        if (overlapsHorizontally && overlapsVertically) {
          y = box.bottom + verticalPadding + height / 2;
          top = y - height / 2;
          bottom = y + height / 2;
          hasOverlap = true;
        }
      }
    }

    const positionedNode = {
      ...node,
      position: {
        ...node.position,
        y,
      },
    };

    positionedNodes.set(node.id, positionedNode);
    placedBoxes.push({ left, right, top, bottom });
  }

  return nodes.map((node) => positionedNodes.get(node.id) ?? node);
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

function CalendarDateField({
  label,
  value,
  onChange,
  minDate,
  maxDate,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfUtcMonth(toUtcDate(value)));

  useEffect(() => {
    setViewMonth(startOfUtcMonth(toUtcDate(value)));
  }, [value]);

  const days = useMemo(() => {
    const firstVisibleDate = addUtcDays(startOfUtcMonth(viewMonth), -startOfUtcMonth(viewMonth).getUTCDay());
    return Array.from({ length: 42 }, (_, index) => addUtcDays(firstVisibleDate, index));
  }, [viewMonth]);

  const minTime = minDate ? toUtcDate(minDate).getTime() : Number.NEGATIVE_INFINITY;
  const maxTime = maxDate ? toUtcDate(maxDate).getTime() : Number.POSITIVE_INFINITY;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: UI_TEXT_SECONDARY,
        }}
      >
        {label}
      </div>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        style={{
          ...toolbarButtonStyle,
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
      >
        <span>{formatDisplayDate(value)}</span>
        <span style={{ color: UI_TEXT_SECONDARY, fontSize: 11 }}>{isOpen ? "Close" : "Pick"}</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "relative",
            zIndex: 8,
            padding: 10,
            border: `1px solid ${UI_BORDER_SUBTLE}`,
            borderRadius: 10,
            background: UI_CARD,
            boxShadow: "0 14px 28px rgba(0, 0, 0, 0.24)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <button
              type="button"
              onClick={() => setViewMonth((current) => startOfUtcMonth(addUtcMonths(current, -1)))}
              style={smallGhostButtonStyle}
            >
              Prev
            </button>
            <div style={{ fontSize: 12, fontWeight: 700, color: UI_TEXT_PRIMARY }}>
              {formatDisplayMonth(viewMonth)}
            </div>
            <button
              type="button"
              onClick={() => setViewMonth((current) => startOfUtcMonth(addUtcMonths(current, 1)))}
              style={smallGhostButtonStyle}
            >
              Next
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: 6,
              marginBottom: 6,
            }}
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                style={{
                  fontSize: 10,
                  textAlign: "center",
                  color: UI_TEXT_SECONDARY,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {day}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: 6,
            }}
          >
            {days.map((day) => {
              const isoDate = formatIsoDate(day);
              const isCurrentMonth = day.getUTCMonth() === viewMonth.getUTCMonth();
              const isSelected = isoDate === value;
              const isWeekend = isWeekendDate(day);
              const isOutOfRange = day.getTime() < minTime || day.getTime() > maxTime;
              const isDisabled = isWeekend || isOutOfRange;

              return (
                <button
                  key={isoDate}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    onChange(isoDate);
                    setIsOpen(false);
                  }}
                  title={`${formatShortWeekday(day)} ${formatDisplayDate(isoDate)}`}
                  style={{
                    height: 30,
                    borderRadius: 8,
                    border: `1px solid ${
                      isSelected ? UI_ACCENT : isWeekend ? withAlpha(UI_BORDER_STRONG, 0.6) : UI_BORDER_SUBTLE
                    }`,
                    background: isSelected
                      ? withAlpha(UI_ACCENT, 0.22)
                      : isWeekend
                        ? withAlpha(UI_TEXT_SECONDARY, 0.08)
                        : UI_ELEVATED,
                    color: !isCurrentMonth
                      ? withAlpha(UI_TEXT_SECONDARY, 0.45)
                      : isDisabled
                        ? withAlpha(UI_TEXT_SECONDARY, 0.55)
                        : UI_TEXT_PRIMARY,
                    fontSize: 11,
                    fontWeight: isSelected ? 700 : 500,
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    opacity: isCurrentMonth ? 1 : 0.72,
                  }}
                >
                  {day.getUTCDate()}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: UI_TEXT_SECONDARY }}>
            Weekends are unavailable for simulations.
          </div>
        </div>
      )}
    </div>
  );
}

function ReplayTimeline({
  session,
  mode,
  activeDayIndex,
  hoveredDayIndex,
  selectedDayIndex,
  highlight,
  onEnterReplay,
  onExitReplay,
  onHoverDay,
  onLeaveDay,
  onSelectDay,
}: {
  session: ReplaySession;
  mode: ReplayMode;
  activeDayIndex: number;
  hoveredDayIndex: number | null;
  selectedDayIndex: number;
  highlight: boolean;
  onEnterReplay: () => void;
  onExitReplay: () => void;
  onHoverDay: (index: number) => void;
  onLeaveDay: () => void;
  onSelectDay: (index: number) => void;
}) {
  const activeDay = session.replayDays[activeDayIndex];

  return (
    <div
      style={{
        position: "relative",
        padding: "12px 16px 14px",
        borderTop: `1px solid ${UI_BORDER_SUBTLE}`,
        background: UI_PANEL,
        boxShadow: highlight ? `0 -2px 18px ${withAlpha(UI_ACCENT, 0.36)}` : "none",
        transition: "box-shadow 180ms ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: UI_TEXT_SECONDARY,
              marginBottom: 2,
            }}
          >
            Replay
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: UI_TEXT_PRIMARY }}>
            {formatDisplayDate(activeDay.date)} • {activeDay.changedNodeCount} nodes changed
          </div>
        </div>

        <button
          type="button"
          onClick={mode === "replay" ? onExitReplay : onEnterReplay}
          style={{
            ...toolbarButtonStyle,
            width: "auto",
            cursor: "pointer",
            borderColor: mode === "replay" ? UI_ACCENT : UI_BORDER_SUBTLE,
            background: mode === "replay" ? withAlpha(UI_ACCENT, 0.16) : UI_CARD,
          }}
        >
          {mode === "replay" ? "Back to edit" : "Open Replay"}
        </button>
      </div>

      <div
        style={{
          marginBottom: 10,
          padding: "10px 12px",
          borderRadius: 10,
          border: `1px solid ${
            activeDay.status === "error"
              ? "#E24B4A"
              : activeDay.status === "warning"
                ? "#E8A33B"
                : UI_BORDER_SUBTLE
          }`,
          background:
            activeDay.status === "error"
              ? "rgba(226, 75, 74, 0.08)"
              : activeDay.status === "warning"
                ? "rgba(232, 163, 59, 0.08)"
                : UI_CARD,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: UI_TEXT_SECONDARY }}>
          <span>Equity {formatCurrency(activeDay.trace.balanceSnapshot.equity)}</span>
          <span>Cash {formatCurrency(activeDay.trace.balanceSnapshot.cash)}</span>
          <span>Realized {formatSignedCurrency(activeDay.trace.balanceSnapshot.realizedPnl)}</span>
        </div>
        {activeDay.previewLines.length > 0 ? (
          activeDay.previewLines.map((line) => (
            <div key={`${activeDay.date}-${line}`} style={{ fontSize: 12, color: UI_TEXT_PRIMARY }}>
              {line}
            </div>
          ))
        ) : (
          <div style={{ fontSize: 12, color: UI_TEXT_SECONDARY }}>
            No node output values changed from the previous day.
          </div>
        )}
      </div>

      <div style={{ position: "relative", overflowX: "auto", paddingTop: 8, width: "100%", minWidth: 0 }}>
        <div
          style={{
            position: "absolute",
            left: 18,
            right: 18,
            top: 20,
            height: 2,
            background: UI_BORDER_STRONG,
            opacity: 0.8,
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: "max-content",
            padding: "0 4px",
          }}
        >
          {session.replayDays.map((day) => {
            const isSelected = day.index === selectedDayIndex;
            const isHovered = day.index === hoveredDayIndex;
            const background =
              isSelected
                ? UI_ACCENT
                : day.status === "error"
                  ? "#E24B4A"
                  : day.status === "warning"
                    ? "#E8A33B"
                    : UI_TEXT_SECONDARY;

            return (
              <button
                key={day.date}
                type="button"
                onMouseEnter={() => onHoverDay(day.index)}
                onMouseLeave={onLeaveDay}
                onFocus={() => onHoverDay(day.index)}
                onBlur={onLeaveDay}
                onClick={() => onSelectDay(day.index)}
                title={`${formatDisplayDate(day.date)} • ${
                  day.status === "error"
                    ? "errors"
                    : day.status === "warning"
                      ? "warnings"
                      : "clean"
                }`}
                style={{
                  width: isHovered || isSelected ? 14 : 10,
                  height: isHovered || isSelected ? 14 : 10,
                  borderRadius: 999,
                  border: `2px solid ${isHovered ? UI_CARD : background}`,
                  background,
                  boxShadow: isSelected ? `0 0 0 4px ${withAlpha(UI_ACCENT, 0.18)}` : "none",
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "transform 120ms ease, width 120ms ease, height 120ms ease, box-shadow 120ms ease",
                  transform: isHovered ? "translateY(-2px)" : "translateY(0)",
                }}
              />
            );
          })}
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
  const [simulationConfig, setSimulationConfig] = useState<StrategySimulationConfig>(() =>
    buildDefaultSimulationConfig()
  );
  const [simulationSession, setSimulationSession] = useState<ReplaySession | null>(null);
  const [sandboxMode, setSandboxMode] = useState<ReplayMode>("edit");
  const [selectedReplayDayIndex, setSelectedReplayDayIndex] = useState(0);
  const [hoveredReplayDayIndex, setHoveredReplayDayIndex] = useState<number | null>(null);
  const [isReplayTimelineHighlighted, setIsReplayTimelineHighlighted] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const replayHighlightTimeoutRef = useRef<number | null>(null);
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
  const graphDatabase = useMemo(() => {
    return buildBackendGraphPayload({ nodes, edges });
  }, [edges, nodes]);
  const currentDraftGraphSignature = useMemo(
    () => serializeGraphSignature({ nodes: stripRuntimeResults(clearNodeIssues(nodes)), edges }),
    [edges, nodes]
  );
  const simulationValidationMessage = useMemo(
    () => validateSimulationConfig(simulationConfig),
    [simulationConfig]
  );
  const replayHasDraftChanges = Boolean(
    simulationSession && simulationSession.graphSignature !== currentDraftGraphSignature
  );
  const activeReplayDayIndex =
    hoveredReplayDayIndex ??
    Math.min(
      selectedReplayDayIndex,
      Math.max((simulationSession?.replayDays.length ?? 1) - 1, 0)
    );
  const activeReplayDay = simulationSession?.replayDays[activeReplayDayIndex] ?? null;
  const replayNodes = useMemo(() => {
    if (!simulationSession || !activeReplayDay) return [];
    const replayNodeIssueMap = buildReplayNodeIssueMap(activeReplayDay.trace);

    const mappedNodes = simulationSession.graphSnapshot.nodes.map((node) => {
      const nodeData = node.data as NodeData;
      const runtimeResult = activeReplayDay.runtimeResults[node.id];
      const changedToday = activeReplayDay.changedNodeIds.has(node.id);
      const replayIssue = replayNodeIssueMap.get(node.id);

      return {
        ...node,
        selected: false,
        zIndex: runtimeResult || replayIssue ? 20 : 1,
        data: {
          ...nodeData,
          runtimeResult,
          runtimeResultMeta: runtimeResult
            ? {
                label: changedToday ? "Updated today" : "Replay",
                glow: changedToday,
              }
            : undefined,
          errorState: replayIssue,
          readOnly: true,
        },
      } as Node<NodeData>;
    });

    return applyReplayNodeSpacing(mappedNodes);
  }, [activeReplayDay, simulationSession]);
  const replayEdges = useMemo(
    () =>
      simulationSession
        ? simulationSession.graphSnapshot.edges.map((edge) => ({
            ...edge,
            selected: false,
          }))
        : [],
    [simulationSession]
  );
  const displayNodes = sandboxMode === "replay" && simulationSession ? replayNodes : nodes;
  const displayEdges = sandboxMode === "replay" && simulationSession ? replayEdges : edges;

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
      if (replayHighlightTimeoutRef.current !== null) {
        window.clearTimeout(replayHighlightTimeoutRef.current);
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

  const flashReplayTimeline = useCallback(() => {
    if (replayHighlightTimeoutRef.current !== null) {
      window.clearTimeout(replayHighlightTimeoutRef.current);
    }
    setIsReplayTimelineHighlighted(true);
    replayHighlightTimeoutRef.current = window.setTimeout(() => {
      setIsReplayTimelineHighlighted(false);
      replayHighlightTimeoutRef.current = null;
    }, 2200);
  }, []);

  const enterReplayForDay = useCallback((dayIndex: number) => {
    setSelectedReplayDayIndex(dayIndex);
    setHoveredReplayDayIndex(null);
    setSandboxMode("replay");
  }, []);

  const onNodesChange = useCallback(
    (changes: Parameters<typeof applyNodeChanges>[0]) => {
      if (sandboxMode === "replay") return;
      if (changes.length > 0) {
        clearRuntimeResults();
      }
      setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
    },
    [clearRuntimeResults, sandboxMode, setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: Parameters<typeof applyEdgeChanges>[0]) => {
      if (sandboxMode === "replay") return;
      clearRuntimeResults();
      setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges));
    },
    [clearRuntimeResults, sandboxMode, setEdges]
  );

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
        setSimulationSession(null);
        setSandboxMode("edit");
        setSelectedReplayDayIndex(0);
        setHoveredReplayDayIndex(null);
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
      if (sandboxMode === "replay") return;
      clearRuntimeResults();
      if (typeof params.target === "string") {
        clearIssueForNode(params.target);
      }
      setEdges((currentEdges) =>
        addEdge({ ...params, type: "smoothstep", animated: true }, currentEdges)
      );
    },
    [clearIssueForNode, clearRuntimeResults, sandboxMode, setEdges]
  );

  const tryCreateNode = useCallback(
    (type: string, position: { x: number; y: number }) => {
      if (sandboxMode === "replay") {
        return false;
      }
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
    [getDefaultNodeData, isSupportedNodeType, nodes.length, notifyTransientBanner, sandboxMode, setNodes]
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
      if (sandboxMode === "replay") return;
      if (event.button !== 0) return;
      event.preventDefault();
      setPaletteDrag(resolveCanvasDragState(nodeType, event.pointerId, event.clientX, event.clientY));
    },
    [resolveCanvasDragState, sandboxMode]
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
    setSimulationSession(null);
    setSandboxMode("edit");
    setSelectedReplayDayIndex(0);
    setHoveredReplayDayIndex(null);
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

    const normalizedSimulationConfig = adjustSimulationRange(simulationConfig);
    const simulationError = validateSimulationConfig(normalizedSimulationConfig);
    setSimulationConfig(normalizedSimulationConfig);
    if (simulationError) {
      notifyTransientBanner("Simulation needs dates", simulationError);
      return;
    }

    setIsStrategyTesting(true);
    dismissTransientBanner();
    setActiveIssues([]);
    setFocusedIssueIndex(0);
    setNodes((currentNodes) => clearNodeIssues(stripRuntimeResults(currentNodes)));

    try {
      const replaySourceGraph = {
        nodes: clearNodeIssues(stripRuntimeResults(nodes)).map((node) => ({
          ...node,
          selected: false,
        })) as Node<NodeData>[],
        edges: edges.map((edge) => ({
          ...edge,
          selected: false,
        })),
      };
      const materializedGraph = materializeInlineMathInputs(nodes, edges);
      const payloadGraph = buildBackendGraphPayload(materializedGraph);

      const payload = {
        strategy: {
          id: currentStrategyId ?? "draft",
          nodes: payloadGraph.nodes as unknown[],
          edges: payloadGraph.edges as unknown[],
        },
        simulation: normalizedSimulationConfig,
      };

      const result = await simulateStrategy(payload);
      const graphSnapshot = cloneReplayGraphSnapshot(replaySourceGraph);
      const replayDays = buildReplayDays(result, graphSnapshot);
      if (replayDays.length === 0) {
        throw new Error("The simulation completed without any replay days to display.");
      }

      const nextSession: ReplaySession = {
        graphSnapshot,
        graphSignature: serializeGraphSignature(replaySourceGraph),
        result,
        replayDays,
      };

      setSimulationSession(nextSession);
      setSandboxMode("replay");
      setSelectedReplayDayIndex(replayDays.length - 1);
      setHoveredReplayDayIndex(null);
      setActiveIssues([]);
      setFocusedIssueIndex(0);
      flashReplayTimeline();
      notifyTransientBanner(
        "Simulation ready",
        `Replay opened on ${formatDisplayDate(replayDays[replayDays.length - 1]?.date ?? normalizedSimulationConfig.endDate)}.`
      );
      window.requestAnimationFrame(() => {
        void fitView({ padding: 0.2, duration: 280 });
      });
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
          formatFallbackErrorMessage(error, "The strategy simulation failed. Review the graph and try again."),
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
    fitView,
    flashReplayTimeline,
    focusIssue,
    nodes,
    nodes.length,
    notifyTransientBanner,
    simulationConfig,
    setNodes,
  ]);

  const isReplayMode = sandboxMode === "replay" && simulationSession !== null;
  const finalReplayDayIndex = simulationSession ? Math.max(simulationSession.replayDays.length - 1, 0) : 0;
  const isFinalReplayDay = Boolean(activeReplayDay && activeReplayDay.index === finalReplayDayIndex);
  const activeReplayPositions = useMemo(() => {
    if (!simulationSession || !activeReplayDay) return [];
    if (isFinalReplayDay) {
      return simulationSession.result.portfolio.positions.map((position) => ({
        ticker: position.ticker,
        quantity: position.quantity,
        averageCost: position.averageCost,
        marketPrice: position.marketPrice,
        marketValue: position.marketValue,
        unrealizedPnl: position.unrealizedPnl,
      }));
    }

    return activeReplayDay.positions.map((position) => ({
      ticker: position.ticker,
      quantity: position.quantity,
      averageCost: position.averageCost,
      marketPrice: null,
      marketValue: undefined,
      unrealizedPnl: undefined,
    }));
  }, [activeReplayDay, isFinalReplayDay, simulationSession]);
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
                    opacity: sandboxMode === "replay" ? 0.42 : paletteDrag?.nodeType === node.type ? 0.35 : 1,
                    cursor: sandboxMode === "replay" ? "not-allowed" : "grab",
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
          {isNodeCatalogLoading
            ? "Loading node types..."
            : sandboxMode === "replay"
              ? "Replay is read-only. Return to edit mode to change the graph."
              : "Drag a node onto the canvas."}
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

      <div
        style={{
          flex: "1 1 0",
          minWidth: 0,
          minHeight: 0,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div ref={canvasWrapperRef} style={{ flex: 1, minWidth: 0, minHeight: 0, height: "100%", width: "100%" }}>
          <ReactFlow
            nodeTypes={nodeTypes}
            nodes={displayNodes}
            edges={displayEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeOrigin={[0.5, 0.5]}
            nodesDraggable={!isReplayMode}
            nodesConnectable={!isReplayMode}
            elementsSelectable={!isReplayMode}
            nodesFocusable={!isReplayMode}
            edgesFocusable={!isReplayMode}
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

        {simulationSession && activeReplayDay && (
          <ReplayTimeline
            session={simulationSession}
            mode={sandboxMode}
            activeDayIndex={activeReplayDayIndex}
            hoveredDayIndex={hoveredReplayDayIndex}
            selectedDayIndex={selectedReplayDayIndex}
            highlight={isReplayTimelineHighlighted}
            onEnterReplay={() => setSandboxMode("replay")}
            onExitReplay={() => {
              setSandboxMode("edit");
              setHoveredReplayDayIndex(null);
            }}
            onHoverDay={setHoveredReplayDayIndex}
            onLeaveDay={() => setHoveredReplayDayIndex(null)}
            onSelectDay={enterReplayForDay}
          />
        )}
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
          width: 340,
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
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={sidebarCardStyle}>
            <div style={sidebarSectionTitleStyle}>{isReplayMode ? "Replay" : "Strategy"}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: UI_TEXT_PRIMARY }}>
              {currentStrategyName ?? "No strategy loaded"}
            </div>
            {currentStrategyId && (
              <div style={{ marginTop: 4, fontSize: 11, color: UI_TEXT_SECONDARY }}>ID: {currentStrategyId}</div>
            )}
            {simulationSession && !isReplayMode && (
              <button
                type="button"
                onClick={() => setSandboxMode("replay")}
                style={{ ...toolbarButtonStyle, marginTop: 10, cursor: "pointer" }}
              >
                Open Replay
              </button>
            )}
            {isReplayMode && (
              <button
                type="button"
                onClick={() => {
                  setSandboxMode("edit");
                  setHoveredReplayDayIndex(null);
                }}
                style={{ ...toolbarButtonStyle, marginTop: 10, cursor: "pointer" }}
              >
                Back to edit
              </button>
            )}
          </div>

          {replayHasDraftChanges && (
            <div
              style={{
                ...sidebarCardStyle,
                borderColor: UI_ACCENT,
                background: withAlpha(UI_ACCENT, 0.1),
              }}
            >
              <div style={sidebarSectionTitleStyle}>Replay status</div>
              <div style={{ fontSize: 12, lineHeight: 1.45, color: UI_TEXT_PRIMARY }}>
                Replay is showing the last simulated graph. Your current draft has changed since that run.
              </div>
            </div>
          )}

          {!isReplayMode && (
            <>
              <div style={sidebarCardStyle}>
                <div style={sidebarSectionTitleStyle}>Simulation</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <CalendarDateField
                    label="Start"
                    value={simulationConfig.startDate}
                    maxDate={simulationConfig.endDate}
                    onChange={(value) =>
                      setSimulationConfig((current) =>
                        adjustSimulationRange({
                          ...current,
                          startDate: value,
                          endDate:
                            toUtcDate(current.endDate).getTime() < toUtcDate(value).getTime()
                              ? value
                              : current.endDate,
                        })
                      )
                    }
                  />
                  <CalendarDateField
                    label="End"
                    value={simulationConfig.endDate}
                    minDate={simulationConfig.startDate}
                    maxDate={formatIsoDate(clampToWeekday(addUtcMonths(toUtcDate(simulationConfig.startDate), 6), -1))}
                    onChange={(value) =>
                      setSimulationConfig((current) =>
                        adjustSimulationRange({
                          ...current,
                          endDate: value,
                        })
                      )
                    }
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={sidebarFieldLabelStyle}>Period</span>
                    <input value="1d" readOnly disabled style={sidebarInputStyle} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={sidebarFieldLabelStyle}>Initial cash</span>
                    <input
                      type="number"
                      min={0}
                      value={simulationConfig.initialCash}
                      onChange={(event) =>
                        setSimulationConfig((current) => ({
                          ...current,
                          initialCash: Number.isFinite(Number(event.target.value))
                            ? Math.max(0, Number(event.target.value))
                            : 0,
                        }))
                      }
                      style={sidebarInputStyle}
                    />
                  </label>
                </div>

                {simulationValidationMessage && (
                  <div style={{ marginTop: 10, fontSize: 12, color: UI_ACCENT }}>
                    {simulationValidationMessage}
                  </div>
                )}
              </div>

              {nodes.length === 0 ? (
                <div style={sidebarCardStyle}>
                  <div style={sidebarSectionTitleStyle}>Saved strategies</div>
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
                </div>
              ) : (
                <div style={sidebarCardStyle}>
                  <div style={sidebarSectionTitleStyle}>Draft</div>
                  <div style={{ fontSize: 12, color: UI_TEXT_SECONDARY }}>
                    This graph is ready. Add nodes or edges, then run the simulation to refresh Replay.
                  </div>
                </div>
              )}
            </>
          )}

          {isReplayMode && simulationSession && activeReplayDay && (
            <>
              <div style={sidebarCardStyle}>
                <div style={sidebarSectionTitleStyle}>Selected day</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: UI_TEXT_PRIMARY }}>
                  {formatDisplayDate(activeReplayDay.date)}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: UI_TEXT_SECONDARY }}>
                  {activeReplayDay.changedNodeCount} nodes changed • {activeReplayDay.changedOutputCount} outputs updated
                </div>
              </div>

              {(activeReplayDay.trace.errors.length > 0 || activeReplayDay.trace.warnings.length > 0) && (
                <div
                  style={{
                    ...sidebarCardStyle,
                    borderColor: activeReplayDay.trace.errors.length > 0 ? "#E24B4A" : "#E8A33B",
                    background:
                      activeReplayDay.trace.errors.length > 0
                        ? "rgba(226, 75, 74, 0.08)"
                        : "rgba(232, 163, 59, 0.08)",
                  }}
                >
                  <div style={sidebarSectionTitleStyle}>Signals</div>
                  {activeReplayDay.trace.errors.map((error) => (
                    <div key={error} style={{ fontSize: 12, color: UI_TEXT_PRIMARY, marginBottom: 6 }}>
                      {error}
                    </div>
                  ))}
                  {activeReplayDay.trace.warnings.map((warning) => (
                    <div key={warning} style={{ fontSize: 12, color: UI_TEXT_PRIMARY, marginBottom: 6 }}>
                      {warning}
                    </div>
                  ))}
                </div>
              )}

              <div style={sidebarCardStyle}>
                <div style={sidebarSectionTitleStyle}>Balance</div>
                <div style={sidebarMetricGridStyle}>
                  <div>
                    <div style={sidebarMetricLabelStyle}>Equity</div>
                    <div style={sidebarMetricValueStyle}>{formatCurrency(activeReplayDay.trace.balanceSnapshot.equity)}</div>
                  </div>
                  <div>
                    <div style={sidebarMetricLabelStyle}>Cash</div>
                    <div style={sidebarMetricValueStyle}>{formatCurrency(activeReplayDay.trace.balanceSnapshot.cash)}</div>
                  </div>
                  <div>
                    <div style={sidebarMetricLabelStyle}>Market value</div>
                    <div style={sidebarMetricValueStyle}>
                      {formatCurrency(activeReplayDay.trace.balanceSnapshot.marketValue)}
                    </div>
                  </div>
                  <div>
                    <div style={sidebarMetricLabelStyle}>Realized P/L</div>
                    <div
                      style={{
                        ...sidebarMetricValueStyle,
                        color:
                          activeReplayDay.trace.balanceSnapshot.realizedPnl >= 0 ? "#6FD58A" : "#F07A7A",
                      }}
                    >
                      {formatSignedCurrency(activeReplayDay.trace.balanceSnapshot.realizedPnl)}
                    </div>
                  </div>
                  <div>
                    <div style={sidebarMetricLabelStyle}>Unrealized P/L</div>
                    <div
                      style={{
                        ...sidebarMetricValueStyle,
                        color:
                          activeReplayDay.trace.balanceSnapshot.unrealizedPnl >= 0 ? "#6FD58A" : "#F07A7A",
                      }}
                    >
                      {formatSignedCurrency(activeReplayDay.trace.balanceSnapshot.unrealizedPnl)}
                    </div>
                  </div>
                </div>
              </div>

              <div style={sidebarCardStyle}>
                <div style={sidebarSectionTitleStyle}>Portfolio</div>
                {activeReplayPositions.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {activeReplayPositions.map((position) => (
                      <div
                        key={position.ticker}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: `1px solid ${UI_BORDER_SUBTLE}`,
                          background: UI_ELEVATED,
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: UI_TEXT_PRIMARY }}>{position.ticker}</div>
                        <div style={{ marginTop: 4, fontSize: 11, color: UI_TEXT_SECONDARY }}>
                          {formatSignedNumber(position.quantity)} shares • avg {formatCurrency(position.averageCost)}
                        </div>
                        {typeof position.marketValue === "number" && (
                          <div style={{ marginTop: 4, fontSize: 11, color: UI_TEXT_SECONDARY }}>
                            Value {formatCurrency(position.marketValue)}
                          </div>
                        )}
                        {typeof position.unrealizedPnl === "number" && (
                          <div style={{ marginTop: 2, fontSize: 11, color: UI_TEXT_SECONDARY }}>
                            Unrealized {formatSignedCurrency(position.unrealizedPnl)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: UI_TEXT_SECONDARY }}>No open positions on this day.</div>
                )}
              </div>

              <div style={sidebarCardStyle}>
                <div style={sidebarSectionTitleStyle}>Trades</div>
                {activeReplayDay.trace.trades.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {activeReplayDay.trace.trades.map((trade) => (
                      <div
                        key={`${trade.nodeId}-${trade.ticker}-${trade.action}-${trade.cashAfter}`}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: `1px solid ${UI_BORDER_SUBTLE}`,
                          background: UI_ELEVATED,
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: UI_TEXT_PRIMARY }}>
                          {trade.action.toUpperCase()} {trade.ticker}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 11, color: UI_TEXT_SECONDARY }}>
                          {formatSignedNumber(trade.filledShares)} shares @ {formatCurrency(trade.fillPrice)}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 11, color: UI_TEXT_SECONDARY }}>
                          Cash {formatCurrency(trade.cashBefore)} → {formatCurrency(trade.cashAfter)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: UI_TEXT_SECONDARY }}>No trades were executed on this day.</div>
                )}
              </div>

              {isFinalReplayDay && (
                <div style={sidebarCardStyle}>
                  <div style={sidebarSectionTitleStyle}>Simulation end</div>
                  <div style={sidebarMetricGridStyle}>
                    <div>
                      <div style={sidebarMetricLabelStyle}>Executed days</div>
                      <div style={sidebarMetricValueStyle}>{simulationSession.result.summary.executedDays}</div>
                    </div>
                    <div>
                      <div style={sidebarMetricLabelStyle}>Trades</div>
                      <div style={sidebarMetricValueStyle}>{simulationSession.result.summary.tradeCount}</div>
                    </div>
                    <div>
                      <div style={sidebarMetricLabelStyle}>Final equity</div>
                      <div style={sidebarMetricValueStyle}>
                        {formatCurrency(simulationSession.result.summary.finalEquity)}
                      </div>
                    </div>
                    <div>
                      <div style={sidebarMetricLabelStyle}>Final cash</div>
                      <div style={sidebarMetricValueStyle}>
                        {formatCurrency(simulationSession.result.summary.finalCash)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {!isReplayMode && (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              type="button"
              onClick={() => void onTestStrategy()}
              disabled={isStrategyTesting || nodes.length === 0 || Boolean(simulationValidationMessage)}
              style={{
                ...toolbarButtonStyle,
                flex: 1,
                opacity: isStrategyTesting || nodes.length === 0 || simulationValidationMessage ? 0.7 : 1,
                cursor:
                  isStrategyTesting || nodes.length === 0 || simulationValidationMessage
                    ? "not-allowed"
                    : "pointer",
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
        )}
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

const smallGhostButtonStyle: React.CSSProperties = {
  padding: "5px 8px",
  borderRadius: 8,
  border: `1px solid ${UI_BORDER_SUBTLE}`,
  background: UI_ELEVATED,
  color: UI_TEXT_PRIMARY,
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
};

const sidebarCardStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: `1px solid ${UI_BORDER_SUBTLE}`,
  borderRadius: 10,
  background: UI_CARD,
};

const sidebarSectionTitleStyle: React.CSSProperties = {
  marginBottom: 8,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: UI_TEXT_SECONDARY,
};

const sidebarFieldLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: UI_TEXT_SECONDARY,
};

const sidebarInputStyle: React.CSSProperties = {
  border: `1px solid ${UI_BORDER_SUBTLE}`,
  borderRadius: 8,
  padding: "8px 10px",
  background: UI_ELEVATED,
  color: UI_TEXT_PRIMARY,
  fontSize: 12,
};

const sidebarMetricGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const sidebarMetricLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: UI_TEXT_SECONDARY,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const sidebarMetricValueStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  fontWeight: 700,
  color: UI_TEXT_PRIMARY,
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
