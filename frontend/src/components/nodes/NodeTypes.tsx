import { useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import { Handle, Position, type Edge, type NodeProps, type NodeTypes, useReactFlow, useStore } from "reactflow";
import {
  NODE_HANDLE_STYLE,
  UI_CANVAS,
  UI_ELEVATED,
  UI_TEXT_PRIMARY,
  UI_TEXT_SECONDARY,
} from "./base/nodeCardStyle";

export type JsonScalar = string | number | boolean | null;
export type NodeRuntimeResult = Record<string, JsonScalar>;

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
  const edges = useStore((state) => state.edges);

  const inputPorts = useMemo(() => data.inputs ?? [], [data.inputs]);
  const outputPorts = useMemo(() => data.outputs ?? [], [data.outputs]);
  const dataFields = useMemo(() => data.dataFields ?? [], [data.dataFields]);
  const fieldValues = data.fieldValues ?? {};
  const inlineInputValues = data.inlineInputValues ?? {};
  const runtimeResult = data.runtimeResult;
  const hasRuntimeResult = runtimeResult && Object.keys(runtimeResult).length > 0;
  const isMathNode = isMathNodeType(data.nodeType);

  const visual = getNodeVisualForTheme(data.theme);

  const setFieldValue = (key: string, value: JsonScalar) => {
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
          },
        };
      })
    );
  };

  const setInlineInputValue = (portIndex: number, rawValue: string) => {
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
          },
        };
      })
    );
  }, [id, normalizedFieldValues, setNodes]);

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
          border: `${visual.borderWidth}px solid ${visual.border}`,
          borderRadius: 10,
          background: visual.background,
          fontFamily: "monospace",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          zIndex: 1,
          minWidth: 160,
          boxShadow: hasRuntimeResult
            ? `0 0 0 1px ${visual.border}, 0 0 18px ${visual.border}55, 0 12px 28px rgba(0, 0, 0, 0.34)`
            : "0 10px 24px rgba(0, 0, 0, 0.18)",
        }}
      >
        {inputPorts.map((port, idx) => (
          <Handle
            key={`in-${port.index}-${port.name}`}
            id={`in:${port.index}`}
            type="target"
            position={Position.Left}
            style={{
              ...NODE_HANDLE_STYLE,
              width: 10,
              height: 10,
              background: visual.handle,
              border: "none",
              left: -8,
              top: getHandleTop(idx, inputPorts.length),
              transform: "translateY(-50%)",
              zIndex: 3,
            }}
          />
        ))}

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
                          checked={Boolean(value)}
                          onChange={(event) => setFieldValue(field.name, event.target.checked)}
                          style={{
                            width: 14,
                            height: 14,
                            margin: 0,
                            accentColor: visual.border,
                          }}
                        />
                        <span style={{ fontSize: 11, color: UI_TEXT_SECONDARY }}>
                          {Boolean(value) ? "true" : "false"}
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
                      style={inputStyle(visual)}
                    />
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {outputPorts.map((port, idx) => (
          <Handle
            key={`out-${port.index}-${port.name}`}
            id={`out:${port.index}`}
            type="source"
            position={Position.Right}
            style={{
              ...NODE_HANDLE_STYLE,
              width: 10,
              height: 10,
              background:
                data.nodeType === "if" && port.index === 0 ? "#639922" : data.nodeType === "if" && port.index === 1 ? "#E24B4A" : visual.handle,
              border: data.nodeType === "if" ? `2px solid ${UI_CANVAS}` : "none",
              right: -8,
              top: getHandleTop(idx, outputPorts.length),
              transform: "translateY(-50%)",
              zIndex: 3,
            }}
          />
        ))}
      </div>

      {hasRuntimeResult && (
        <div
          style={{
            position: "relative",
            zIndex: 0,
            marginTop: -14,
            marginLeft: 16,
            marginRight: 16,
            padding: "22px 14px 12px",
            borderRadius: 8,
            background: UI_ELEVATED,
            border: `1px solid ${visual.border}`,
            boxShadow: "0 12px 26px rgba(0, 0, 0, 0.28)",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: visual.sub,
              }}
            >
              Output
            </div>
            <div
              style={{
                padding: "3px 8px",
                borderRadius: 999,
                background: `${visual.border}22`,
                color: UI_TEXT_PRIMARY,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Updated
            </div>
          </div>
          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: UI_TEXT_PRIMARY,
              fontSize: 11,
              lineHeight: 1.35,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            {JSON.stringify(runtimeResult, null, 2)}
          </pre>
        </div>
      )}
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
