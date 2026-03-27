import { useEffect, useState } from "react";
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
import type { LectureCatalogResponse } from "../features/lectures/types";
import { fetchLectureCatalog } from "../services/lectureApi";

export default function Library() {
  const [catalog, setCatalog] = useState<LectureCatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    void fetchLectureCatalog()
      .then((response) => {
        if (!isActive) return;
        setCatalog(response);
      })
      .catch(() => {
        if (!isActive) return;
        setError("The lecture catalog could not be loaded.");
      });

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <PageShell
      eyebrow="Learning Library"
      title="Lectures are now organized by category."
      description="Browse lecture categories, open a guided lesson, and move through gated sublectures that unlock after checkpoint verification."
    >
      {error && (
        <section
          style={{
            marginBottom: 20,
            padding: 16,
            borderRadius: 18,
            border: `1px solid ${withAlpha("#F07A7A", 0.5)}`,
            background: withAlpha("#F07A7A", 0.12),
            color: UI_TEXT_PRIMARY,
          }}
        >
          {error}
        </section>
      )}

      <section style={{ display: "grid", gap: 18 }}>
        {catalog?.categories.map((category) => (
          <article
            key={category.slug}
            style={{
              padding: 22,
              borderRadius: 24,
              border: `1px solid ${UI_BORDER_SUBTLE}`,
              background: UI_ELEVATED,
              boxShadow: `0 16px 36px ${withAlpha("#000000", 0.18)}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 18,
                alignItems: "start",
                flexWrap: "wrap",
                marginBottom: 18,
              }}
            >
              <div>
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
                  Category
                </div>
                <h2 style={{ margin: 0, fontSize: 28, color: UI_TEXT_PRIMARY }}>{category.title}</h2>
                <p style={{ margin: "10px 0 0", color: UI_TEXT_SECONDARY, lineHeight: 1.7, maxWidth: 720 }}>
                  {category.description}
                </p>
              </div>

              {category.hero && (
                <div
                  style={{
                    maxWidth: 320,
                    padding: "14px 16px",
                    borderRadius: 18,
                    border: `1px solid ${UI_BORDER_SUBTLE}`,
                    background: UI_CARD,
                    color: UI_TEXT_SECONDARY,
                  }}
                >
                  {category.hero}
                </div>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 16,
              }}
            >
              {category.lectures.map((lecture) => (
                <Link
                  key={lecture.id}
                  to={`/library/${lecture.categorySlug}/${lecture.slug}`}
                  style={{
                    padding: 20,
                    borderRadius: 20,
                    border: `1px solid ${UI_BORDER_SUBTLE}`,
                    background: UI_CARD,
                    color: UI_TEXT_PRIMARY,
                    textDecoration: "none",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: UI_ACCENT,
                    }}
                  >
                    {lecture.estimatedMinutes} min lecture
                  </div>
                  <h3 style={{ margin: "10px 0 0", fontSize: 22 }}>{lecture.title}</h3>
                  <p style={{ margin: "10px 0 0", color: UI_TEXT_SECONDARY, lineHeight: 1.6 }}>
                    {lecture.summary}
                  </p>
                </Link>
              ))}
            </div>
          </article>
        ))}
      </section>
    </PageShell>
  );
}
