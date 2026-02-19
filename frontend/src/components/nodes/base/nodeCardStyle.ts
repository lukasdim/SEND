export const NODE_CARD_RADIUS = 20;
export const NODE_CARD_BORDER = "1px solid #d1d5db";
export const NODE_TITLE_PADDING = "14px 16px";
export const NODE_BODY_PADDING = "14px 16px";
export const NODE_TITLE_ALPHA = 0.2;

export const NODE_HANDLE_STYLE: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: 999,
  background: "#94a3b8",
  border: "2px solid #f8fafc",
};

export function withAlpha(color: string, alpha: number): string {
  const normalized = color.trim();
  const clamped = Math.max(0, Math.min(1, alpha));

  if (normalized.startsWith("#")) {
    const hex = normalized.slice(1);
    const expanded =
      hex.length === 3
        ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
        : hex.length === 6
        ? hex
        : null;

    if (expanded) {
      const r = parseInt(expanded.slice(0, 2), 16);
      const g = parseInt(expanded.slice(2, 4), 16);
      const b = parseInt(expanded.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${clamped})`;
    }
  }

  if (normalized.startsWith("rgb(")) {
    const values = normalized
      .slice(4, -1)
      .split(",")
      .map((value) => value.trim());
    if (values.length === 3) {
      return `rgba(${values[0]}, ${values[1]}, ${values[2]}, ${clamped})`;
    }
  }

  if (normalized.startsWith("rgba(")) {
    const values = normalized
      .slice(5, -1)
      .split(",")
      .map((value) => value.trim());
    if (values.length >= 3) {
      return `rgba(${values[0]}, ${values[1]}, ${values[2]}, ${clamped})`;
    }
  }

  return normalized;
}
