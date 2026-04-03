import { Link } from "react-router-dom";
import PageShell from "./PageShell";
import {
  UI_ACCENT,
  UI_BORDER_STRONG,
  UI_BORDER_SUBTLE,
  UI_CARD,
  UI_ELEVATED,
  UI_TEXT_PRIMARY,
  UI_TEXT_SECONDARY,
  withAlpha,
} from "../components/nodes/base/nodeCardStyle";
import { DEFAULT_SEO_IMAGE_PATH } from "../seo/meta";

const highlights = [
  {
    title: "Visual strategy building",
    description: "Compose market logic with nodes instead of wiring everything by hand in code.",
  },
  {
    title: "Guided learning",
    description: "Move from core ideas into practice through lessons that support the sandbox.",
  },
  {
    title: "Historical market data",
    description: "Test and review strategy behavior against past market sessions inside the editor.",
  },
];

const quickAnswers = [
  {
    question: "Need coding experience?",
    answer: "No. SEND is designed to be approachable through graphs and guided lessons.",
  },
  {
    question: "Does it use historical data?",
    answer: "Yes. The sandbox is built to inspect strategies against historical market data.",
  },
  {
    question: "Is it investment advice?",
    answer: "No. SEND is for financial education and strategy learning.",
  },
];

const primaryLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "13px 18px",
  borderRadius: 14,
  textDecoration: "none",
  fontWeight: 700,
};

const sectionStyle = {
  paddingTop: 40,
  borderTop: `1px solid ${withAlpha(UI_BORDER_STRONG, 0.85)}`,
};

export default function Landing() {
  return (
    <PageShell
      eyebrow="Interactive Trading Education"
      title="Build and learn trading logic."
      description="SEND combines guided lessons with a visual sandbox so you can learn trading logic and test ideas on historical market data."
      maxWidth={1320}
      seo={{
        title: "Build and Learn Trading Logic | SEND",
        description:
          "SEND combines guided lessons, visual strategy graphs, and historical market data to help you learn trading logic.",
        canonicalPath: "/",
        imagePath: DEFAULT_SEO_IMAGE_PATH,
        ogType: "website",
      }}
    >
      <div style={{ display: "grid", gap: 104 }}>
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 56,
            alignItems: "center",
          }}
        >
          <div style={{ display: "grid", gap: 28, alignContent: "start" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              <Link
                to="/library/logic/getting-started/what-is-send"
                style={{
                  ...primaryLinkStyle,
                  background: UI_ACCENT,
                  color: "#111118",
                }}
              >
                What is SEND
              </Link>
              <Link
                to="/sandbox?highlight=test-strategy"
                style={{
                  ...primaryLinkStyle,
                  border: `1px solid ${UI_BORDER_STRONG}`,
                  background: UI_CARD,
                  color: UI_TEXT_PRIMARY,
                }}
              >
                Try a strategy
              </Link>
            </div>

            <p style={{ margin: 0, color: UI_TEXT_SECONDARY, lineHeight: 1.7 }}>
              You can also browse the{" "}
              <Link to="/library" style={{ color: UI_ACCENT }}>
                learning library
              </Link>
              , open the{" "}
              <Link to="/library?path=logic" style={{ color: UI_ACCENT }}>
                logic path
              </Link>
              , or explore the{" "}
              <Link to="/library?path=economics" style={{ color: UI_ACCENT }}>
                economics path
              </Link>
              .
            </p>
          </div>

          <div
            style={{
              padding: 18,
              borderRadius: 28,
              border: `1px solid ${UI_BORDER_SUBTLE}`,
              background: `linear-gradient(180deg, ${withAlpha(UI_ELEVATED, 0.98)}, ${withAlpha(UI_CARD, 0.9)})`,
              boxShadow: `0 20px 40px ${withAlpha("#000000", 0.22)}`,
            }}
          >
            <img
              src={DEFAULT_SEO_IMAGE_PATH}
              alt="SEND strategy sandbox showing a decision graph, market data panels, and replay results"
              width={1600}
              height={900}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              style={{
                display: "block",
                width: "100%",
                height: "auto",
                borderRadius: 20,
                border: `1px solid ${UI_BORDER_SUBTLE}`,
              }}
            />
          </div>
        </section>

        <section aria-labelledby="landing-overview" style={sectionStyle}>
          <h2 id="landing-overview" style={{ margin: 0, fontSize: 28, color: UI_TEXT_PRIMARY }}>
            Overview
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              columnGap: 32,
              rowGap: 40,
              marginTop: 28,
            }}
          >
            {highlights.map((item) => (
              <article
                key={item.title}
                style={{
                  paddingRight: 18,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 20, color: UI_TEXT_PRIMARY }}>{item.title}</h3>
                <p style={{ margin: "10px 0 0", color: UI_TEXT_SECONDARY, lineHeight: 1.7 }}>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="landing-start-here"
          style={{
            ...sectionStyle,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 52,
            alignItems: "start",
          }}
        >
          <div>
            <h2 id="landing-start-here" style={{ margin: 0, fontSize: 28, color: UI_TEXT_PRIMARY }}>
              Start where you want
            </h2>
            <p style={{ margin: "12px 0 0", color: UI_TEXT_SECONDARY, lineHeight: 1.75, maxWidth: 560 }}>
              If you want context first, begin with the learning side. If you want to explore the editor, open the
              sandbox and see how the system behaves with historical market data.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 48,
            }}
          >
            <div style={{ borderLeft: `2px solid ${withAlpha(UI_ACCENT, 0.45)}`, paddingLeft: 18 }}>
              <h3 style={{ margin: 0, fontSize: 20, color: UI_TEXT_PRIMARY }}>Learning</h3>
              <p style={{ margin: "10px 0 0", color: UI_TEXT_SECONDARY, lineHeight: 1.75 }}>
                Use the library to understand core ideas before you start wiring strategies together.
              </p>
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                <Link to="/library/logic/getting-started/what-is-send" style={{ color: UI_ACCENT, textDecoration: "none" }}>
                  Open the beginner SEND lesson
                </Link>
                <Link to="/library?path=logic" style={{ color: UI_ACCENT, textDecoration: "none" }}>
                  Browse the logic path
                </Link>
                <Link to="/library?path=economics" style={{ color: UI_ACCENT, textDecoration: "none" }}>
                  Explore the economics path
                </Link>
              </div>
            </div>

            <div style={{ borderLeft: `2px solid ${withAlpha(UI_BORDER_STRONG, 0.8)}`, paddingLeft: 18 }}>
              <h3 style={{ margin: 0, fontSize: 20, color: UI_TEXT_PRIMARY }}>Sandbox</h3>
              <p style={{ margin: "10px 0 0", color: UI_TEXT_SECONDARY, lineHeight: 1.75 }}>
                Build visually, inspect the graph, and replay how a strategy behaved over time.
              </p>
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                <Link to="/sandbox?highlight=test-strategy" style={{ color: UI_ACCENT, textDecoration: "none" }}>
                  Open the strategy sandbox
                </Link>
                <Link to="/library" style={{ color: UI_ACCENT, textDecoration: "none" }}>
                  See the full learning library
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="landing-quick-answers" style={sectionStyle}>
          <h2 id="landing-quick-answers" style={{ margin: 0, fontSize: 28, color: UI_TEXT_PRIMARY }}>
            Quick answers
          </h2>
          <div style={{ display: "grid", marginTop: 28 }}>
            {quickAnswers.map((item, index) => (
              <article
                key={item.question}
                style={{
                  padding: "20px 0",
                  borderBottom:
                    index === quickAnswers.length - 1 ? "none" : `1px solid ${withAlpha(UI_BORDER_SUBTLE, 0.9)}`,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 18, color: UI_TEXT_PRIMARY }}>{item.question}</h3>
                <p style={{ margin: "8px 0 0", color: UI_TEXT_SECONDARY, lineHeight: 1.7 }}>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
