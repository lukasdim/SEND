import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import type { LectureCatalogPath, LectureCatalogResponse } from "../features/lectures/types";
import { fetchLectureCatalog } from "../services/lectureApi";

export default function Library() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalog, setCatalog] = useState<LectureCatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPathSlug, setSelectedPathSlug] = useState("logic");

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

  useEffect(() => {
    if (!catalog) {
      return;
    }

    const requestedPathSlug = searchParams.get("path")?.trim();
    const fallbackPathSlug = catalog.paths.find((path) => path.slug === "logic")?.slug ?? catalog.paths[0]?.slug ?? "logic";
    const nextPathSlug = catalog.paths.some((path) => path.slug === requestedPathSlug)
      ? (requestedPathSlug as string)
      : fallbackPathSlug;

    setSelectedPathSlug((current) => (current === nextPathSlug ? current : nextPathSlug));
  }, [catalog, searchParams]);

  const selectedPath: LectureCatalogPath | null =
    catalog?.paths.find((path) => path.slug === selectedPathSlug) ?? catalog?.paths[0] ?? null;

  const handleSelectPath = (pathSlug: string) => {
    setSelectedPathSlug(pathSlug);
    setSearchParams(pathSlug === "logic" ? {} : { path: pathSlug });
  };

  return (
    <PageShell
      eyebrow="Learning Library"
      title="Choose a path, then follow its categories."
      description="Logic is shown first by default. Switch between Logic and Economics, then open a guided lecture from the categories inside that path."
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

      <section style={{ display: "grid", gap: 22 }}>
        <div
          style={{
            width: "100%",
            padding: 8,
            borderRadius: 999,
            border: `1px solid ${UI_BORDER_STRONG}`,
            background: UI_ELEVATED,
            boxShadow: `0 18px 40px ${withAlpha("#000000", 0.18)}`,
            display: "flex",
            gap: 8,
          }}
        >
          {(catalog?.paths ?? []).map((path) => {
            const isActive = path.slug === selectedPathSlug;
            return (
              <button
                key={path.slug}
                type="button"
                onClick={() => handleSelectPath(path.slug)}
                style={{
                  flex: 1,
                  minHeight: 72,
                  borderRadius: 999,
                  border: `1px solid ${isActive ? UI_BORDER_STRONG : UI_BORDER_SUBTLE}`,
                  background: isActive ? `linear-gradient(135deg, ${withAlpha(UI_ACCENT, 0.3)}, ${withAlpha("#FAC775", 0.22)})` : UI_CARD,
                  color: UI_TEXT_PRIMARY,
                  fontSize: 20,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  cursor: "pointer",
                }}
              >
                {path.title}
              </button>
            );
          })}
        </div>

        {selectedPath && (
          <section
            style={{
              padding: 22,
              borderRadius: 28,
              border: `1px solid ${UI_BORDER_SUBTLE}`,
              background: UI_ELEVATED,
              boxShadow: `0 16px 36px ${withAlpha("#000000", 0.18)}`,
            }}
          >
            <div style={{ display: "grid", gap: 8 }}>
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
                  width: "fit-content",
                }}
              >
                Active Path
              </div>
              <h2 style={{ margin: 0, fontSize: 34, color: UI_TEXT_PRIMARY }}>{selectedPath.title}</h2>
              {selectedPath.description && (
                <p style={{ margin: 0, color: UI_TEXT_SECONDARY, lineHeight: 1.7, maxWidth: 760 }}>
                  {selectedPath.description}
                </p>
              )}
            </div>
          </section>
        )}

        {selectedPath?.categories.map((category) => (
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

            {category.lectures.length === 0 ? (
              <div
                style={{
                  padding: 22,
                  borderRadius: 20,
                  border: `1px dashed ${UI_BORDER_STRONG}`,
                  background: withAlpha(UI_CARD, 0.72),
                  color: UI_TEXT_SECONDARY,
                  lineHeight: 1.7,
                }}
              >
                No lectures are published in this category yet.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 18,
                }}
              >
                {category.lectures.map((lecture) => (
                  <Link
                    key={lecture.id}
                    to={`/library/${lecture.pathSlug}/${lecture.categorySlug}/${lecture.slug}`}
                    style={{
                      flex: "1 1 240px",
                      minWidth: 220,
                      maxWidth: 280,
                      aspectRatio: "3 / 4",
                      padding: 20,
                      borderRadius: 22,
                      border: `1px solid ${UI_BORDER_SUBTLE}`,
                      background: `linear-gradient(180deg, ${UI_CARD}, ${withAlpha(UI_ELEVATED, 0.96)})`,
                      color: UI_TEXT_PRIMARY,
                      textDecoration: "none",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      boxShadow: `0 14px 30px ${withAlpha("#000000", 0.16)}`,
                    }}
                  >
                    <div>
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
                      <h3 style={{ margin: "12px 0 0", fontSize: 24, lineHeight: 1.05 }}>{lecture.title}</h3>
                    </div>

                    <p style={{ margin: 0, color: UI_TEXT_SECONDARY, lineHeight: 1.7 }}>{lecture.summary}</p>
                  </Link>
                ))}
              </div>
            )}
          </article>
        ))}
      </section>
    </PageShell>
  );
}
