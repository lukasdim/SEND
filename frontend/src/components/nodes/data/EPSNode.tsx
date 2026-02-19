import { useMemo } from "react";
import type { JSX } from "react";
import BaseNode, { type NodeData } from "../base/TwoHandles";
import type { NodeProps } from "reactflow";
import { useReactFlow } from "reactflow";

type NodeDefinition = {
  type: string;
  label: string;
  data: NodeData<EPSExtraData>;
};

type NodeComponent = ((props: NodeProps<EPSNodeData>) => JSX.Element) & {
  definition: NodeDefinition;
  accent: string;
  color: string;
};

export type EPSExtraData = {
  ticker: string;
  value: number | null;
};

export type EPSNodeData = NodeData<EPSExtraData>;

const EPSNode: NodeComponent = function EPSNode({ id, data }: NodeProps<EPSNodeData>) {
  const { setNodes } = useReactFlow();
  const extra = useMemo<EPSExtraData>(
    () => ({ ticker: data.extra?.ticker ?? "", value: data.extra?.value ?? null }),
    [data.extra?.ticker, data.extra?.value]
  );

  const setExtra = (patch: Partial<EPSExtraData>) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== id) return node;
        const nodeData = node.data as EPSNodeData;
        return {
          ...node,
          data: {
            ...nodeData,
            extra: {
              ticker: nodeData.extra?.ticker ?? "",
              value: nodeData.extra?.value ?? null,
              ...patch,
            },
          },
        };
      })
    );
  };

  return (
    <BaseNode data={data} accent={EPSNode.accent} color={EPSNode.color}>
      <div style={{ display: "flex", gap: 8, width: "100%" }}>
        <input
          className="nodrag"
          type="text"
          placeholder="Ticker"
          value={extra.ticker}
          onChange={(event) => setExtra({ ticker: event.target.value.toUpperCase() })}
          style={inputStyle}
        />
        <input
          className="nodrag"
          type="number"
          step="0.01"
          placeholder="Value"
          value={extra.value ?? ""}
          onChange={(event) => {
            const raw = event.target.value.trim();
            if (raw === "") {
              setExtra({ value: null });
              return;
            }

            const parsed = Number.parseFloat(raw);
            setExtra({ value: Number.isFinite(parsed) ? parsed : null });
          }}
          style={inputStyle}
        />
      </div>
    </BaseNode>
  );
};

EPSNode.definition = {
  type: "eps",
  label: "EPS",
  data: { label: "EPS", extra: { ticker: "", value: null } },
};
EPSNode.accent = "#16a34a";
EPSNode.color = "#bee9ff";

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "6px 8px",
  fontSize: 12,
  lineHeight: 1.2,
  outline: "none",
  background: "white",
};

export default EPSNode;
