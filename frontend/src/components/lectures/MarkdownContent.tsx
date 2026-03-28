import type { CSSProperties, ReactNode } from "react";
import { UI_ACCENT, UI_TEXT_PRIMARY, UI_TEXT_SECONDARY } from "../nodes/base/nodeCardStyle";
import { parseMarkdown, slugifyMarkdownHeading } from "./markdown-utils";

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

export default function MarkdownContent({
  source,
  sectionId,
}: {
  source: string;
  sectionId: string;
}) {
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
          const headingId = `${sectionId}--${slugifyMarkdownHeading(block.text)}`;
          return (
            <h2
              key={`${block.type}-${index}`}
              id={headingId}
              data-lecture-anchor="true"
              className="lecture-anchor-target"
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
