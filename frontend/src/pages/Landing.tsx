import { Link } from "react-router-dom";
import PageShell from "./PageShell";
import {
  UI_ACCENT,
  UI_BORDER_SUBTLE,
  UI_CARD,
  UI_ELEVATED,
  UI_TEXT_PRIMARY,
  UI_TEXT_SECONDARY,
  withAlpha,
} from "../components/nodes/base/nodeCardStyle";

const highlights = [
  {
    title: "Visual strategy building",
    description: "Compose market logic with nodes instead of wiring everything by hand in code.",
  },
  {
    title: "Practice before depth",
    description: "Use the sandbox today, with guided lessons and deeper learning flows coming soon.",
  },
  {
    title: "Reusable systems later",
    description: "The current shell is intentionally lightweight and leaves room for richer modules later.",
  },
];

export default function Landing() {
  return (
    <PageShell
      eyebrow="Landing Page"
      title="Build and learn trading logic in one place."
      description="SEND combines a node-based sandbox with a future learning path for financial concepts. The editor is already live, and the learning experience is scaffolded here as a polished placeholder for deeper implementation later."
      maxWidth={1320}
    >
      <section
        style={{
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          marginBottom: 36,
        }}
      >
        <Link
          to="/library"
          style={{
            padding: "12px 18px",
            borderRadius: 14,
            background: UI_ACCENT,
            color: "#111118",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Explore learning modules
        </Link>
        <Link
          to="/sandbox"
          style={{
            padding: "12px 18px",
            borderRadius: 14,
            border: `1px solid ${UI_BORDER_SUBTLE}`,
            background: UI_CARD,
            color: UI_TEXT_PRIMARY,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Open the sandbox
        </Link>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 36,
        }}
      >
        {highlights.map((item) => (
          <article
            key={item.title}
            style={{
              padding: 20,
              borderRadius: 18,
              border: `1px solid ${UI_BORDER_SUBTLE}`,
              background: UI_CARD,
              boxShadow: `0 10px 28px ${withAlpha("#000000", 0.18)}`,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20, color: UI_TEXT_PRIMARY }}>{item.title}</h2>
            <p style={{ margin: "10px 0 0", color: UI_TEXT_SECONDARY, lineHeight: 1.6 }}>
              {item.description}
            </p>
          </article>
        ))}
      </section>

      <section
        style={{
          padding: 24,
          borderRadius: 22,
          border: `1px solid ${UI_BORDER_SUBTLE}`,
          background: UI_ELEVATED,
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: UI_ACCENT, marginBottom: 10 }}>
          What&apos;s Coming
        </div>
        <p style={{ margin: 0, color: UI_TEXT_SECONDARY, lineHeight: 1.7 }}>
          The next layer of SEND will add a fuller learning library, richer lesson flows, and more structured onboarding.
          This page is intentionally minimal for now, but it gives the product a proper home outside the editor.
        </p>
      </section>
    </PageShell>
  );
}
