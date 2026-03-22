import PageShell from "./PageShell";
import {
  UI_ACCENT,
  UI_BORDER_STRONG,
  UI_BORDER_SUBTLE,
  UI_CARD,
  UI_TEXT_PRIMARY,
  UI_TEXT_SECONDARY,
} from "../components/nodes/base/nodeCardStyle";

const placeholderModules = [
  {
    title: "Reading price action",
    description: "A future module on interpreting movement, trend structure, and context before building a graph.",
  },
  {
    title: "Core company metrics",
    description: "A placeholder lesson set for EPS, P/E ratio, beta, and other fundamentals already exposed in the sandbox.",
  },
  {
    title: "Strategy logic foundations",
    description: "A guided path for conditions, comparisons, and composing reusable patterns with nodes.",
  },
  {
    title: "Testing and iteration",
    description: "A future walkthrough on validating ideas, reading outputs, and improving graph behavior over time.",
  },
];

export default function Library() {
  return (
    <PageShell
      eyebrow="Learning Library"
      title="Learning modules are on the way."
      description="This page is a polished placeholder for the future lesson library. It outlines the shape of the learning experience without introducing full lesson routing or content just yet."
    >
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {placeholderModules.map((module) => (
          <article
            key={module.title}
            style={{
              padding: 20,
              borderRadius: 18,
              border: `1px solid ${UI_BORDER_SUBTLE}`,
              background: UI_CARD,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 999,
                border: `1px solid ${UI_BORDER_STRONG}`,
                color: UI_ACCENT,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              Coming soon
            </div>

            <h2 style={{ margin: 0, fontSize: 20, color: UI_TEXT_PRIMARY }}>{module.title}</h2>
            <p style={{ margin: "10px 0 0", color: UI_TEXT_SECONDARY, lineHeight: 1.6 }}>
              {module.description}
            </p>
          </article>
        ))}
      </section>
    </PageShell>
  );
}
