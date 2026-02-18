import { Handle, Position } from "reactflow";

export type NodeData = { label: string; subtitle?: string };

export const handleStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
};

export default function BaseNode({
  data,
  accent,
}: {
  data: NodeData;
  accent: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: 10,
        border: `1px solid ${accent}`,
        borderRadius: 12,
        background: "white",
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />

      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.1 }}>
        {data.label}
      </div>

      {data.subtitle && (
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
          {data.subtitle}
        </div>
      )}

      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  );
}
