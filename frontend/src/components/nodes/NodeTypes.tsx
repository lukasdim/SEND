import { useMemo } from "react";
import type { CSSProperties } from "react";
import { Handle, Position, type NodeProps, type NodeTypes, useReactFlow } from "reactflow";
import {
  NODE_BODY_PADDING,
  NODE_CARD_BORDER,
  NODE_CARD_RADIUS,
  NODE_HANDLE_STYLE,
  NODE_TITLE_ALPHA,
  NODE_TITLE_PADDING,
  withAlpha,
} from "./base/nodeCardStyle";

export type JsonScalar = string | number | boolean | null;
export type NodeRuntimeResult = Record<string, JsonScalar>;

export type NodeIoCatalog = {
  nodes: NodeIoDefinition[];
};

export type NodeIoDefinition = {
  nodeType: string;
  nodeClass: string;
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
  valueType: string;
  valueTypeClass: string;
  required: boolean;
  defaultValue?: JsonScalar;
};

export type NodeData = {
  label: string;
  nodeClass: string;
  inputs: NodeIoPort[];
  outputs: NodeIoPort[];
  dataFields: NodeIoDataField[];
  fieldValues: Record<string, JsonScalar>;
  runtimeResult?: NodeRuntimeResult;
};

export type NodePaletteItem = {
  type: string;
  label: string;
  inputCount: number;
  outputCount: number;
};

type NodeVisual = {
  accent: string;
  color: string;
};

export type NodeRegistry = {
  nodePalette: NodePaletteItem[];
  nodeTypes: NodeTypes;
  isSupportedNodeType: (type: string) => boolean;
  getDefaultNodeData: (type: string) => NodeData | undefined;
  getNodeVisual: (type: string) => NodeVisual | undefined;
};

function hashToAccentColor(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 74% 44%)`;
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

function getHandleTop(index: number, total: number): string {
  return `${((index + 1) / (total + 1)) * 100}%`;
}

function DynamicNode({ id, data }: NodeProps<NodeData>) {
  const { setNodes } = useReactFlow();

  const inputPorts = useMemo(() => data.inputs ?? [], [data.inputs]);
  const outputPorts = useMemo(() => data.outputs ?? [], [data.outputs]);
  const dataFields = useMemo(() => data.dataFields ?? [], [data.dataFields]);
  const fieldValues = data.fieldValues ?? {};
  const runtimeResult = data.runtimeResult;
  const hasRuntimeResult = runtimeResult && Object.keys(runtimeResult).length > 0;

  const accent = hashToAccentColor(data.label);
  const runtimeGlowTight = withAlpha(accent, 0.42);
  const runtimeGlowWide = withAlpha(accent, 0.24);

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
          border: NODE_CARD_BORDER,
          borderRadius: NODE_CARD_RADIUS,
          background: "#ffffff",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          zIndex: 1,
          boxShadow: hasRuntimeResult
            ? `0 0 14px ${runtimeGlowTight}, 0 0 26px ${runtimeGlowWide}, 0 6px 14px rgba(15, 23, 42, 0.08)`
            : undefined,
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
            borderRadius: NODE_CARD_RADIUS,
            overflow: "hidden",
            background: "#ffffff",
          }}
        >
          <div
            style={{
              padding: NODE_TITLE_PADDING,
              background: withAlpha(accent, NODE_TITLE_ALPHA),
              borderBottom: dataFields.length > 0 || hasRuntimeResult ? "1px solid #e5e7eb" : undefined,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.1, color: "#111827" }}>
              {data.label}
            </div>
          </div>

          {dataFields.length > 0 && (
            <div
              style={{
                padding: NODE_BODY_PADDING,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                background: "#ffffff",
              }}
            >
              {dataFields.map((field) => {
                const inputType = toInputType(field.valueType);
                const value = fieldValues[field.name] ?? toInitialFieldValue(field);

                return (
                  <label
                    key={`field-${field.name}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: inputType === "checkbox" ? "1fr auto" : "1fr",
                      gap: 6,
                      color: "#111827",
                      fontSize: 12,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>
                      {field.name}
                      {field.required ? " *" : ""}
                    </span>
                    {inputType === "checkbox" ? (
                      <input
                        className="nodrag"
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(event) => setFieldValue(field.name, event.target.checked)}
                        style={{ width: 16, height: 16 }}
                      />
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
                        style={inputStyle}
                      />
                    )}
                    <span style={{ color: "#6b7280", fontSize: 11 }}>{field.valueType}</span>
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
            borderRadius: NODE_CARD_RADIUS - 4,
            background: "#ffffff",
            boxShadow: "0 8px 14px rgba(15, 23, 42, 0.14)",
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
                color: "#6b7280",
              }}
            >
              Output
            </div>
            <div
              style={{
                padding: "3px 8px",
                borderRadius: 999,
                background: withAlpha(accent, 0.14),
                color: "#111827",
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
              color: "#111827",
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

const inputStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "6px 8px",
  fontSize: 12,
  lineHeight: 1.2,
  outline: "none",
  background: "white",
  color: "black",
};

export function createNodeRegistry(catalog: NodeIoCatalog): NodeRegistry {
  const nodeDataByType: Record<string, NodeData> = {};
  const nodeVisualByType: Record<string, NodeVisual> = {};
  const reactFlowTypes: NodeTypes = {};

  for (const node of catalog.nodes) {
    const fieldValues = Object.fromEntries(
      node.dataFields.map((field) => [field.name, toInitialFieldValue(field)])
    ) as Record<string, JsonScalar>;

    nodeDataByType[node.nodeType] = {
      label: node.nodeType,
      nodeClass: node.nodeClass,
      inputs: node.inputs,
      outputs: node.outputs,
      dataFields: node.dataFields,
      fieldValues,
    };

    nodeVisualByType[node.nodeType] = {
      accent: hashToAccentColor(node.nodeType),
      color: "#ffffff",
    };
    reactFlowTypes[node.nodeType] = DynamicNode;
  }

  const nodePalette = catalog.nodes.map((node) => ({
    type: node.nodeType,
    label: node.nodeType,
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
