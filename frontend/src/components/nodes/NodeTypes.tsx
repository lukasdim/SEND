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

export type NodeIoCatalog = {
  nodes: NodeIoDefinition[];
};

export type NodeIoDefinition = {
  nodeType: string;
  nodeClass: string;
  inputs: NodeIoPort[];
  outputs: NodeIoPort[];
};

export type NodeIoPort = {
  index: number;
  name: string;
  arity: string;
  valueType: string;
  valueTypeClass: string;
};

export type NodeData = {
  label: string;
  nodeClass: string;
  inputs: NodeIoPort[];
  outputs: NodeIoPort[];
  extra?: Record<string, unknown>;
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

function toDefaultExtraValue(port: NodeIoPort): string | number | boolean {
  if (port.valueType === "NumVal") return 0;
  if (port.valueType === "BoolVal") return false;
  return "";
}

function toInputType(port: NodeIoPort): "text" | "number" | "checkbox" {
  if (port.valueType === "NumVal") return "number";
  if (port.valueType === "BoolVal") return "checkbox";
  return "text";
}

function getHandleTop(index: number, total: number): string {
  return `${((index + 1) / (total + 1)) * 100}%`;
}

function DynamicNode({ id, data }: NodeProps<NodeData>) {
  const { setNodes } = useReactFlow();
  const extra = data.extra ?? {};

  const inputPorts = useMemo(() => data.inputs ?? [], [data.inputs]);
  const outputPorts = useMemo(() => data.outputs ?? [], [data.outputs]);

  const accent = hashToAccentColor(data.label);

  const setExtra = (key: string, value: string | number | boolean) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== id) return node;
        const nodeData = node.data as NodeData;
        return {
          ...node,
          data: {
            ...nodeData,
            extra: {
              ...(nodeData.extra ?? {}),
              [key]: value,
            },
          },
        };
      })
    );
  };

  return (
    <div
      style={{
        width: "100%",
        border: NODE_CARD_BORDER,
        borderRadius: NODE_CARD_RADIUS,
        background: "#ffffff",
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
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
          }}
        />
      ))}

      <div
        style={{
          padding: NODE_TITLE_PADDING,
          background: withAlpha(accent, NODE_TITLE_ALPHA),
          borderBottom: inputPorts.length > 0 ? "1px solid #e5e7eb" : undefined,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.1, color: "#111827" }}>
          {data.label}
        </div>
      </div>

      {inputPorts.length > 0 && (
        <div style={{ padding: NODE_BODY_PADDING, display: "flex", flexDirection: "column", gap: 8 }}>
          {inputPorts.map((port) => {
            const inputType = toInputType(port);
            const value = extra[port.name];

            return (
              <label
                key={`field-${port.index}-${port.name}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: inputType === "checkbox" ? "1fr auto" : "1fr",
                  gap: 6,
                  color: "#111827",
                  fontSize: 12,
                }}
              >
                <span style={{ fontWeight: 600 }}>{port.name}</span>
                {inputType === "checkbox" ? (
                  <input
                    className="nodrag"
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(event) => setExtra(port.name, event.target.checked)}
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
                        setExtra(port.name, Number.isFinite(parsed) ? parsed : 0);
                        return;
                      }
                      setExtra(port.name, event.target.value);
                    }}
                    style={inputStyle}
                  />
                )}
                <span style={{ color: "#6b7280", fontSize: 11 }}>{port.valueType}</span>
              </label>
            );
          })}
        </div>
      )}

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
          }}
        />
      ))}
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
    const extra = Object.fromEntries(
      node.inputs.map((port) => [port.name, toDefaultExtraValue(port)])
    );

    nodeDataByType[node.nodeType] = {
      label: node.nodeType,
      nodeClass: node.nodeClass,
      inputs: node.inputs,
      outputs: node.outputs,
      extra,
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
        extra: data.extra ? { ...data.extra } : undefined,
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
