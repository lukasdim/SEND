import type { CSSProperties, ReactNode } from "react";
import { UI_ACCENT, UI_TEXT_PRIMARY, UI_TEXT_SECONDARY } from "../nodes/base/nodeCardStyle";

type MarkdownBlock =
  | { type: "heading1"; text: string }
  | { type: "heading2"; text: string }
  | { type: "ordered"; items: string[] }
  | { type: "unordered"; items: string[] }
  | { type: "paragraph"; text: string };

function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trim() ?? "";
    if (line.length === 0) {
      index += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push({ type: "heading1", text: line.slice(2).trim() });
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push({ type: "heading2", text: line.slice(3).trim() });
      index += 1;
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length && (lines[index]?.trim() ?? "").startsWith("- ")) {
        items.push((lines[index] ?? "").trim().slice(2).trim());
        index += 1;
      }
      blocks.push({ type: "unordered", items });
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s/.test((lines[index]?.trim() ?? ""))) {
        items.push((lines[index] ?? "").trim().replace(/^\d+\.\s/, ""));
        index += 1;
      }
      blocks.push({ type: "ordered", items });
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length) {
      const nextLine = lines[index]?.trim() ?? "";
      if (
        nextLine.length === 0 ||
        nextLine.startsWith("# ") ||
        nextLine.startsWith("## ") ||
        nextLine.startsWith("- ") ||
        /^\d+\.\s/.test(nextLine)
      ) {
        break;
      }
      paragraphLines.push(nextLine);
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}

function renderInlineText(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`)/g);

  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={`${part}-${index}`}
          style={{
            padding: "2px 6px",
            borderRadius: 7,
            background: "rgba(175, 169, 236, 0.1)",
            color: UI_ACCENT,
            fontSize: "0.92em",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

const paragraphStyle: CSSProperties = {
  margin: "0 0 18px",
  color: UI_TEXT_SECONDARY,
  lineHeight: 1.8,
  fontSize: 17,
};

export default function MarkdownContent({ source }: { source: string }) {
  const blocks = parseMarkdown(source);

  return (
    <div>
      {blocks.map((block, index) => {
        if (block.type === "heading1") {
          return (
            <h1
              key={`${block.type}-${index}`}
              style={{
                margin: "0 0 18px",
                fontSize: "clamp(2.6rem, 6vw, 4.8rem)",
                lineHeight: 0.98,
                color: UI_TEXT_PRIMARY,
              }}
            >
              {renderInlineText(block.text)}
            </h1>
          );
        }

        if (block.type === "heading2") {
          return (
            <h2
              key={`${block.type}-${index}`}
              style={{
                margin: "28px 0 12px",
                fontSize: 30,
                lineHeight: 1.1,
                color: UI_TEXT_PRIMARY,
              }}
            >
              {renderInlineText(block.text)}
            </h2>
          );
        }

        if (block.type === "unordered") {
          return (
            <ul
              key={`${block.type}-${index}`}
              style={{
                margin: "0 0 18px 20px",
                color: UI_TEXT_SECONDARY,
                lineHeight: 1.8,
                fontSize: 17,
                padding: 0,
              }}
            >
              {block.items.map((item) => (
                <li key={item} style={{ marginBottom: 8 }}>
                  {renderInlineText(item)}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "ordered") {
          return (
            <ol
              key={`${block.type}-${index}`}
              style={{
                margin: "0 0 18px 20px",
                color: UI_TEXT_SECONDARY,
                lineHeight: 1.8,
                fontSize: 17,
                padding: 0,
              }}
            >
              {block.items.map((item) => (
                <li key={item} style={{ marginBottom: 8 }}>
                  {renderInlineText(item)}
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={`${block.type}-${index}`} style={paragraphStyle}>
            {renderInlineText(block.text)}
          </p>
        );
      })}
    </div>
  );
}
