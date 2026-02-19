import { Handle, Position } from "reactflow";

export type NodeData<TExtra = Record<string, unknown>> = {
  label: string;
  extra?: TExtra;
};

const handleStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: 999,
  background: "#94a3b8",
  border: "2px solid #f8fafc",
};

function translucent(color: string, alphaHex: string): string {
  if (color.startsWith("#") && color.length === 7) {
    return `${color}${alphaHex}`;
  }
  return color;
}

export default function BaseNode({
  data,
  accent,
  color,
  children,
}: {
  data: NodeData;
  accent: string;
  color: string;
  children?: React.ReactNode;
}) {
  const hasBody = children !== undefined && children !== null;

  return (
    <div
      style={{
        width: "100%",
        border: "1px solid #d1d5db",
        borderRadius: 20,
        background: color,
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ ...handleStyle, left: -8 }}
      />

      <div
        style={{
          padding: "14px 16px",
          background: translucent(accent, "1A"),
          borderBottom: hasBody ? "1px solid #e5e7eb" : undefined,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.1 }}>
          {data.label}
        </div>
      </div>

      {hasBody && (
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center" }}>
          {children}
        </div>
      )}
    </div>
  );
}
