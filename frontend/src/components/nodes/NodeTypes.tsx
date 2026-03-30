/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import { Handle, Position, type Edge, type NodeProps, type NodeTypes, useReactFlow, useStore, useUpdateNodeInternals } from "reactflow";
import {
  NODE_HANDLE_STYLE,
  UI_CANVAS,
  UI_TEXT_PRIMARY,
  UI_TEXT_SECONDARY,
  withAlpha,
} from "./base/nodeCardStyle";

export type JsonScalar = string | number | boolean | null;
export type NodeRuntimeResult = Record<string, JsonScalar>;
export type NodeIssueSeverity = "error" | "warning";
export type NodeRuntimeResultMeta = {
  label?: string;
  glow?: boolean;
};

export type NodeErrorState = {
  severity: NodeIssueSeverity;
  summary: string;
  details?: string[];
  portIndex?: number;
};

export type NodeIoCatalog = {
  nodes: NodeIoDefinition[];
};

export type NodeIoDefinition = {
  nodeType: string;
  displayName: string;
  nodeClass: string;
  theme: CategoryTheme;
  inputs: NodeIoPort[];
  outputs: NodeIoPort[];
  dataFields: NodeIoDataField[];
};

export type NodeIoPort = {
  index: number;
  name: string;
  arity: string;
  valueType: string;
  valueTypeClass: string;
};

export type NodeIoDataField = {
  name: string;
  label?: string;
  valueType: string;
  valueTypeClass: string;
  required: boolean;
  defaultValue?: JsonScalar;
  options?: string[];
  readableOptions?: string[];
  optionFilter?: NodeIoDataFieldOptionFilter;
};

export type NodeIoDataFieldOptionFilter = {
  field: string;
  groups: Record<string, NodeIoDataFieldOptionGroup>;
};

export type NodeIoDataFieldOptionGroup = {
  options: string[];
  readableOptions?: string[];
};

export type NodeData = {
  nodeType: string;
  displayName: string;
  nodeClass: string;
  theme: CategoryTheme;
  inputs: NodeIoPort[];
  outputs: NodeIoPort[];
  dataFields: NodeIoDataField[];
  fieldValues: Record<string, JsonScalar>;
  inlineInputValues?: Record<string, number>;
  runtimeResult?: NodeRuntimeResult;
  runtimeResultMeta?: NodeRuntimeResultMeta;
  errorState?: NodeErrorState;
  readOnly?: boolean;
};

export type NodePaletteItem = {
  type: string;
  label: string;
  inputCount: number;
  outputCount: number;
};

type NodeVisual = {
  background: string;
  border: string;
  title: string;
  sub: string;
  handle: string;
  color: string;
  category: string;
  borderWidth: number;
};

export type NodeRegistry = {
  nodePalette: NodePaletteItem[];
  nodeTypes: NodeTypes;
  isSupportedNodeType: (type: string) => boolean;
  getDefaultNodeData: (type: string) => NodeData | undefined;
  getNodeVisual: (type: string) => NodeVisual | undefined;
};

const CATEGORY_THEMES = {
  market: { bg: "#0F1A14", border: "#1D9E75", title: "#5DCAA5", sub: "#1D9E75", category: "market data", borderWidth: 1.5 },
  const: { bg: "#111118", border: "#5F5E5A", title: "#D3D1C7", sub: "#5F5E5A", category: "constant", borderWidth: 1.5 },
  math: { bg: "#0D1520", border: "#185FA5", title: "#85B7EB", sub: "#378ADD", category: "math", borderWidth: 1.5 },
  compare: { bg: "#1A1510", border: "#854F0B", title: "#EF9F27", sub: "#BA7517", category: "comparison", borderWidth: 1.5 },
  logic: { bg: "#1E1B38", border: "#534AB7", title: "#AFA9EC", sub: "#7F77DD", category: "logic", borderWidth: 1.5 },
  convert: { bg: "#1A130E", border: "#993C1D", title: "#F0997B", sub: "#D85A30", category: "type conversion", borderWidth: 1.5 },
  derived: { bg: "#1A1020", border: "#993556", title: "#ED93B1", sub: "#D4537E", category: "derived metric", borderWidth: 1.5 },
  flow: { bg: "#1A1608", border: "#EF9F27", title: "#FAC775", sub: "#EF9F27", category: "flow control", borderWidth: 2 },
} as const;

export type CategoryTheme = keyof typeof CATEGORY_THEMES;

export const MATH_NODE_TYPES = ["add", "subtract", "multiply", "divide", "negate"] as const;

export function isMathNodeType(nodeType: string): boolean {
  return (MATH_NODE_TYPES as readonly string[]).includes(nodeType);
}

function hasOwnRecordKey(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function getNodeTheme(theme: string | undefined): CategoryTheme {
  if (theme && theme in CATEGORY_THEMES) {
    return theme as CategoryTheme;
  }
  return "const";
}

function getNodeVisualForTheme(theme: string | undefined): NodeVisual {
  const resolvedTheme = CATEGORY_THEMES[getNodeTheme(theme)];
  return {
    background: resolvedTheme.bg,
    border: resolvedTheme.border,
    title: resolvedTheme.title,
    sub: resolvedTheme.sub,
    handle: resolvedTheme.border,
    color: resolvedTheme.bg,
    category: resolvedTheme.category,
    borderWidth: resolvedTheme.borderWidth,
  };
}

function toFallbackFieldValue(field: NodeIoDataField): JsonScalar {
  if (field.valueType === "NumVal") return 0;
  if (field.valueType === "BoolVal") return false;
  return "";
}

function toInitialFieldValue(field: NodeIoDataField): JsonScalar {
  return field.defaultValue ?? toFallbackFieldValue(field);
}

function toInputType(valueType: string): "text" | "number" | "checkbox" {
  if (valueType === "NumVal") return "number";
  if (valueType === "BoolVal") return "checkbox";
  return "text";
}

function getFieldLabel(field: NodeIoDataField): string {
  return field.label ?? field.name;
}

function getSelectableOptions(
  field: NodeIoDataField,
  fieldValues: Record<string, JsonScalar>
): NodeIoDataFieldOptionGroup | null {
  if (field.optionFilter) {
    const controllingValue = fieldValues[field.optionFilter.field];
    if (typeof controllingValue === "string") {
      const optionGroup = field.optionFilter.groups[controllingValue];
      if (optionGroup && optionGroup.options.length > 0) {
        return optionGroup;
      }
    }
  }

  if (field.options && field.options.length > 0) {
    return {
      options: field.options,
      readableOptions: field.readableOptions,
    };
  }

  return null;
}

function getFirstSelectableValue(
  field: NodeIoDataField,
  fieldValues: Record<string, JsonScalar>
): string | null {
  const selectableOptions = getSelectableOptions(field, fieldValues);
  if (!selectableOptions || selectableOptions.options.length === 0) {
    return null;
  }

  if (
    typeof field.defaultValue === "string" &&
    selectableOptions.options.includes(field.defaultValue)
  ) {
    return field.defaultValue;
  }

  return selectableOptions.options[0] ?? null;
}

function getHandleTop(index: number, total: number): string {
  return `${((index + 1) / (total + 1)) * 100}%`;
}

function formatPortType(port: NodeIoPort): string {
  const typeClass = port.valueTypeClass?.toLowerCase();
  const typeRaw = port.valueType?.toLowerCase();

  const resolved = typeClass || typeRaw || "";
  switch (resolved) {
    case "number":
    case "num":
    case "numval":
      return "Number Value";
    case "boolean":
    case "bool":
    case "boolval":
      return "Boolean Value";
    case "any":
    case "value":
      return "Any Value";
    case "string":
    case "str":
    case "strval":
      return "String Value";
    default:
      return port.valueTypeClass || port.valueType || "unknown";
  }
}

function toDisplayLabel(raw: string | undefined, portIndex: number, isInput: boolean): string {
  const base = raw && raw.trim().length > 0 ? raw : isInput ? `input ${portIndex + 1}` : `output ${portIndex + 1}`;
  return base.replace(/_/g, " ");
}

function getPortValue(port: NodeIoPort, runtimeResult: NodeRuntimeResult | undefined, inlineInputValues?: Record<string, number>): JsonScalar | undefined {
  if (runtimeResult && hasOwnRecordKey(runtimeResult, port.name)) {
    return runtimeResult[port.name];
  }
  if (inlineInputValues && hasOwnRecordKey(inlineInputValues, String(port.index))) {
    return inlineInputValues[String(port.index)];
  }
  return undefined;
}

function buildPortTooltip(
  port: NodeIoPort,
  isInput: boolean,
  runtimeResult: NodeRuntimeResult | undefined,
  inlineInputValues?: Record<string, number>
) {
  const label = toDisplayLabel(port.name, port.index, isInput);
  const typeLabel = formatPortType(port);
  const value = getPortValue(port, runtimeResult, inlineInputValues);
  const valueLabel = value === undefined ? "—" : formatRuntimeValue(value);
  const metaLine = isInput ? typeLabel : `${typeLabel} — ${valueLabel}`;
  const aria = `${label} — ${metaLine}`;
  return { label, metaLine, aria };
}

function NodeHeader({ visual, name }: { visual: NodeVisual; name: string }) {
  return (
    <div style={{ padding: "10px 14px 8px" }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: visual.title }}>{name}</div>
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
  );
}

function DynamicNode({ id, data }: NodeProps<NodeData>) {
  const { setNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const edges = useStore((state) => state.edges);

  const inputPorts = useMemo(() => data.inputs ?? [], [data.inputs]);
  const outputPorts = useMemo(() => data.outputs ?? [], [data.outputs]);
  const dataFields = useMemo(() => data.dataFields ?? [], [data.dataFields]);
  const fieldValues = useMemo(() => data.fieldValues ?? {}, [data.fieldValues]);
  const inlineInputValues = data.inlineInputValues ?? {};
  const runtimeResult = data.runtimeResult;
  const hasRuntimeResult = runtimeResult && Object.keys(runtimeResult).length > 0;
  const runtimeResultMeta = data.runtimeResultMeta;
  const isMathNode = isMathNodeType(data.nodeType);
  const errorState = data.errorState;
  const hasErrorState = Boolean(errorState);
  const issueColor = errorState?.severity === "warning" ? "#E8A33B" : "#E24B4A";
  const isReadOnly = data.readOnly === true;
  const shouldGlowRuntimeResult: boolean = Boolean(runtimeResultMeta?.glow ?? hasRuntimeResult);

  const visual = getNodeVisualForTheme(data.theme);

  const setFieldValue = (key: string, value: JsonScalar) => {
    if (isReadOnly) return;
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== id) return node;
        const nodeData = node.data as NodeData;
        return {
          ...node,
          data: {
            ...nodeData,
            fieldValues: {
              ...(nodeData.fieldValues ?? {}),
              [key]: value,
            },
            runtimeResult: undefined,
            runtimeResultMeta: undefined,
            errorState: undefined,
          },
        };
      })
    );
  };

  const setInlineInputValue = (portIndex: number, rawValue: string) => {
    if (isReadOnly) return;
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== id) return node;
        const nodeData = node.data as NodeData;
        const nextInlineInputValues = { ...(nodeData.inlineInputValues ?? {}) };
        const key = String(portIndex);

        if (rawValue.trim() === "") {
          delete nextInlineInputValues[key];
        } else {
          const parsed = Number(rawValue);
          nextInlineInputValues[key] = Number.isFinite(parsed) ? parsed : 0;
        }

        return {
          ...node,
          data: {
            ...nodeData,
            inlineInputValues: nextInlineInputValues,
            runtimeResult: undefined,
            runtimeResultMeta: undefined,
            errorState: undefined,
          },
        };
      })
    );
  };

  const normalizedFieldValues = useMemo(() => {
    const nextFieldValues = { ...fieldValues };
    let hasChanges = false;

    for (const field of dataFields) {
      const selectableOptions = getSelectableOptions(field, nextFieldValues);
      if (!selectableOptions || selectableOptions.options.length === 0) {
        continue;
      }

      const currentValue = nextFieldValues[field.name];
      if (
        typeof currentValue === "string" &&
        selectableOptions.options.includes(currentValue)
      ) {
        continue;
      }

      const nextValue = getFirstSelectableValue(field, nextFieldValues);
      if (nextValue !== null) {
        nextFieldValues[field.name] = nextValue;
        hasChanges = true;
      }
    }

    return hasChanges ? nextFieldValues : null;
  }, [dataFields, fieldValues]);

  useEffect(() => {
    if (!normalizedFieldValues) {
      return;
    }

    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== id) return node;
        const nodeData = node.data as NodeData;
        return {
          ...node,
          data: {
            ...nodeData,
            fieldValues: normalizedFieldValues,
            runtimeResult: undefined,
            runtimeResultMeta: undefined,
          },
        };
      })
    );
  }, [id, isReadOnly, normalizedFieldValues, setNodes]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [
    id,
    updateNodeInternals,
    data.inputs,
    data.outputs,
    data.dataFields,
    data.runtimeResult,
    data.runtimeResultMeta,
    data.errorState,
    data.readOnly,
  ]);

  const renderPortHandle = (port: NodeIoPort, idx: number, side: "left" | "right") => {
    const isInput = side === "left";
    const tooltip = buildPortTooltip(port, isInput, runtimeResult, inlineInputValues);
    const wrapperPositionStyle: CSSProperties = {
      position: "absolute",
      top: getHandleTop(idx, isInput ? inputPorts.length : outputPorts.length),
      transform: "translateY(-50%)",
      zIndex: 3,
      left: isInput ? -8 : undefined,
      right: isInput ? undefined : -8,
      display: "inline-block",
    };

    const tooltipStyle: CSSProperties & { [key: string]: string | undefined } = {
      ["--port-tooltip-border" as string]: visual.handle,
      ["--port-tooltip-bg" as string]: withAlpha(UI_CANVAS, 0.9),
    };

    return (
      <div className={`port-with-tooltip port-${side}`} style={wrapperPositionStyle} key={`${side}-${port.index}-${port.name}`}>
        <Handle
          id={`${isInput ? "in" : "out"}:${port.index}`}
          type={isInput ? "target" : "source"}
          position={isInput ? Position.Left : Position.Right}
          aria-label={tooltip.aria}
          style={{
            ...NODE_HANDLE_STYLE,
            width: 10,
            height: 10,
            background:
              data.nodeType === "if" && !isInput && port.index === 0
                ? "#639922"
                : data.nodeType === "if" && !isInput && port.index === 1
                  ? "#E24B4A"
                  : errorState?.portIndex === port.index
                    ? issueColor
                    : visual.handle,
            border:
              data.nodeType === "if" && !isInput
                ? `2px solid ${UI_CANVAS}`
                : errorState?.portIndex === port.index
                  ? `2px solid ${UI_CANVAS}`
                  : "none",
            position: "relative",
            left: 0,
            right: 0,
            top: 0,
            transform: "none",
          }}
        />
        <span className="port-tooltip" style={tooltipStyle}>
          <span className="port-tooltip__label">{tooltip.label}</span>
          <span className="port-tooltip__meta">{tooltip.metaLine}</span>
        </span>
      </div>
    );
  };

  return (
    <div
      style={{
        width: "100%",
        position: "relative",
        overflow: "visible",
      }}
    >
      <div
        style={{
          border: `${hasErrorState ? 2 : visual.borderWidth}px solid ${hasErrorState ? issueColor : visual.border}`,
          borderRadius: 10,
          background: visual.background,
          fontFamily: "monospace",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          zIndex: 1,
          minWidth: 160,
          boxShadow: hasRuntimeResult
            ? shouldGlowRuntimeResult
              ? `0 0 0 1px ${visual.border}, 0 0 18px ${visual.border}55, 0 12px 28px rgba(0, 0, 0, 0.34)`
              : "0 10px 24px rgba(0, 0, 0, 0.18)"
            : hasErrorState
              ? `0 0 0 1px ${issueColor}, 0 0 18px ${issueColor}35, 0 12px 28px rgba(0, 0, 0, 0.3)`
              : "0 10px 24px rgba(0, 0, 0, 0.18)",
        }}
      >
        {inputPorts.map((port, idx) => renderPortHandle(port, idx, "left"))}

        <div
          style={{
            position: "relative",
            zIndex: 2,
            borderRadius: 10,
            overflow: "hidden",
            background: visual.background,
          }}
        >
          <NodeHeader visual={visual} name={data.displayName} />

          {errorState && (
            <div
              style={{
                margin: "0 10px 10px",
                padding: "10px 11px",
                borderRadius: 8,
                border: `1px solid ${issueColor}`,
                background: `${issueColor}14`,
                color: UI_TEXT_PRIMARY,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: issueColor,
                  }}
                >
                  {errorState.severity === "warning" ? "Needs review" : "Needs attention"}
                </div>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: `${issueColor}26`,
                    color: issueColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  !
                </div>
              </div>
              <div style={{ fontSize: 11, color: UI_TEXT_SECONDARY }}>See Signals for the full diagnostic.</div>
            </div>
          )}

          {dataFields.length > 0 && (
            <div
              style={{
                padding: "0 10px 10px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                background: visual.background,
              }}
            >
              {dataFields.map((field) => {
                const inputType = toInputType(field.valueType);
                const effectiveFieldValues = normalizedFieldValues ?? fieldValues;
                const value = effectiveFieldValues[field.name] ?? toInitialFieldValue(field);
                const selectableOptions = getSelectableOptions(field, effectiveFieldValues);
                const fieldLabel = getFieldLabel(field);
                const boolValue = value === true;

                return (
                  <label
                    key={`field-${field.name}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: inputType === "checkbox" ? "1fr auto" : "1fr",
                      gap: 4,
                      color: UI_TEXT_PRIMARY,
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: visual.sub,
                        marginBottom: 2,
                      }}
                    >
                      {fieldLabel}
                      {field.required ? " *" : ""}
                    </span>
                    {inputType === "checkbox" ? (
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "2px 0 4px",
                        }}
                      >
                        <input
                          className="nodrag"
                          type="checkbox"
                          checked={boolValue}
                          onChange={(event) => setFieldValue(field.name, event.target.checked)}
                          disabled={isReadOnly}
                          style={{
                            width: 14,
                            height: 14,
                            margin: 0,
                            accentColor: visual.border,
                          }}
                        />
                        <span style={{ fontSize: 11, color: UI_TEXT_SECONDARY }}>
                          {boolValue ? "true" : "false"}
                        </span>
                      </label>
                    ) : selectableOptions ? (
                      <select
                        className="nodrag"
                        value={
                          typeof value === "string"
                            ? value
                            : getFirstSelectableValue(field, effectiveFieldValues) ?? ""
                        }
                        onChange={(event) => setFieldValue(field.name, event.target.value)}
                        disabled={isReadOnly}
                        style={inputStyle(visual)}
                      >
                        {selectableOptions.options.map((option, index) => (
                          <option key={`${field.name}-${option}`} value={option}>
                            {selectableOptions.readableOptions?.[index] ?? option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="nodrag"
                        type={inputType}
                        value={
                          typeof value === "number" || typeof value === "string"
                            ? value
                            : inputType === "number"
                              ? 0
                              : ""
                        }
                        onChange={(event) => {
                          if (inputType === "number") {
                            const parsed = Number(event.target.value);
                            setFieldValue(field.name, Number.isFinite(parsed) ? parsed : 0);
                            return;
                          }
                          setFieldValue(field.name, event.target.value);
                        }}
                        disabled={isReadOnly}
                        style={inputStyle(visual)}
                      />
                    )}
                  </label>
                );
              })}
            </div>
          )}

          {isMathNode && inputPorts.length > 0 && (
            <div
              style={{
                padding: "0 10px 10px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                background: visual.background,
              }}
            >
              {inputPorts.map((port) => {
                const hasWire = hasIncomingEdgeForPort(edges, id, port, inputPorts.length);
                const inlineInputKey = String(port.index);
                const hasInlineValue = hasOwnRecordKey(inlineInputValues, inlineInputKey);
                const inlineValue = inlineInputValues[inlineInputKey];

                return (
                  <label
                    key={`inline-port-${inlineInputKey}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr",
                      gap: 4,
                      color: UI_TEXT_PRIMARY,
                      fontSize: 12,
                      opacity: hasWire ? 0.65 : 1,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: visual.sub,
                        marginBottom: 2,
                      }}
                    >
                      {port.name}
                      {hasWire ? " (wired)" : " (fallback)"}
                    </span>
                    <input
                      className="nodrag"
                      type="number"
                      value={hasInlineValue && typeof inlineValue === "number" ? inlineValue : ""}
                      placeholder="0"
                      onChange={(event) => setInlineInputValue(port.index, event.target.value)}
                      disabled={isReadOnly}
                      style={inputStyle(visual)}
                    />
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {outputPorts.map((port, idx) => renderPortHandle(port, idx, "right"))}
      </div>

    </div>
  );
}

function inputStyle(visual: NodeVisual): CSSProperties {
  return {
    border: "1px solid #2a2a3a",
    borderRadius: 6,
    padding: "6px 9px",
    fontSize: 11,
    lineHeight: 1.2,
    outline: "none",
    background: UI_CANVAS,
    color: UI_TEXT_SECONDARY,
    fontFamily: "monospace",
    boxSizing: "border-box",
    width: "100%",
    boxShadow: `inset 0 0 0 1px ${visual.border}10`,
  };
}

const MAX_RUNTIME_VALUE_LENGTH = 26;

function formatRuntimeValue(value: JsonScalar): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return value.toString();
  if (typeof value === "string") return truncateValue(value);
  return truncateValue(JSON.stringify(value));
}

function truncateValue(value: string): string {
  if (value.length <= MAX_RUNTIME_VALUE_LENGTH) return value;
  return `${value.slice(0, MAX_RUNTIME_VALUE_LENGTH - 3)}...`;
}
function hasIncomingEdgeForPort(edges: Edge[], nodeId: string, port: NodeIoPort, inputCount: number): boolean {
  return edges.some((edge) => {
    if (edge.target !== nodeId) return false;
    if (edge.targetHandle === `in:${port.index}`) return true;
    return edge.targetHandle == null && inputCount === 1 && port.index === 0;
  });
}

export function createNodeRegistry(catalog: NodeIoCatalog): NodeRegistry {
  const nodeDataByType: Record<string, NodeData> = {};
  const nodeVisualByType: Record<string, NodeVisual> = {};
  const reactFlowTypes: NodeTypes = {};

  for (const node of catalog.nodes) {
    const fieldValues = Object.fromEntries(
      node.dataFields.map((field) => [field.name, toInitialFieldValue(field)])
    ) as Record<string, JsonScalar>;

    nodeDataByType[node.nodeType] = {
      nodeType: node.nodeType,
      displayName: node.displayName,
      nodeClass: node.nodeClass,
      theme: node.theme,
      inputs: node.inputs,
      outputs: node.outputs,
      dataFields: node.dataFields,
      fieldValues,
    };

    nodeVisualByType[node.nodeType] = getNodeVisualForTheme(node.theme);
    reactFlowTypes[node.nodeType] = DynamicNode;
  }

  const nodePalette = catalog.nodes.map((node) => ({
    type: node.nodeType,
    label: node.displayName,
    inputCount: node.inputs.length,
    outputCount: node.outputs.length,
  }));

  return {
    nodePalette,
    nodeTypes: reactFlowTypes,
    isSupportedNodeType: (type: string) => type in nodeDataByType,
    getDefaultNodeData: (type: string) => {
      const data = nodeDataByType[type];
      if (!data) return undefined;
  return {
      ...data,
      inputs: [...data.inputs],
      outputs: [...data.outputs],
      dataFields: data.dataFields.map((field) => ({ ...field })),
      fieldValues: { ...data.fieldValues },
      errorState: data.errorState ? { ...data.errorState, details: data.errorState.details ? [...data.errorState.details] : undefined } : undefined,
      };
    },
    getNodeVisual: (type: string) => {
      const visual = nodeVisualByType[type];
      return visual ? { ...visual } : undefined;
    },
  };
}

export function createEmptyNodeRegistry(): NodeRegistry {
  return createNodeRegistry({ nodes: [] });
}
