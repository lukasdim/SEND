import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import LectureMiniSandbox from "../components/lectures/LectureMiniSandbox";
import MarkdownContent from "../components/lectures/MarkdownContent";
import { getLectureCategory, getLectureDefinition } from "../content/lectures/registry";
import type { LectureDefinition, LectureProgress, LectureSectionNavItem } from "../features/lectures/types";
import { fetchLectureProgress, saveLectureProgress, verifyLectureCheckpoint } from "../services/lectureApi";
import "./LecturePage.css";

function buildDefaultProgress(lecture: LectureDefinition): LectureProgress {
  return {
    lectureId: lecture.id,
    highestUnlockedSublectureIndex: 0,
    completedCheckpointIds: [],
    activeCheckpointState: {},
  };
}

function clampIndex(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export default function LecturePage() {
  const { categorySlug = "", lectureSlug = "" } = useParams();
  const lecture = getLectureDefinition(categorySlug, lectureSlug);
  const category = getLectureCategory(categorySlug);
  const [progress, setProgress] = useState<LectureProgress | null>(lecture ? buildDefaultProgress(lecture) : null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isProgressLoading, setIsProgressLoading] = useState(true);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [isVerifyingCheckpoint, setIsVerifyingCheckpoint] = useState(false);

  useEffect(() => {
    if (!lecture) {
      return;
    }

    let isActive = true;
    setIsProgressLoading(true);
    setProgressError(null);
    setProgress(buildDefaultProgress(lecture));
    setActiveIndex(0);

    void fetchLectureProgress(lecture.id)
      .then((nextProgress) => {
        if (!isActive) {
          return;
        }

        setProgress(nextProgress);
        setActiveIndex(clampIndex(nextProgress.highestUnlockedSublectureIndex, 0, lecture.sublectures.length - 1));
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        const fallbackProgress = buildDefaultProgress(lecture);
        setProgress(fallbackProgress);
        setActiveIndex(0);
        setProgressError("Progress could not be loaded, so this lecture started from the first unlocked section.");
      })
      .finally(() => {
        if (isActive) {
          setIsProgressLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [lecture]);

  if (!lecture || !category) {
    return <Navigate to="/library" replace />;
  }

  const safeProgress = progress ?? buildDefaultProgress(lecture);
  const highestUnlockedIndex = clampIndex(
    safeProgress.highestUnlockedSublectureIndex,
    0,
    lecture.sublectures.length - 1
  );
  const currentIndex = clampIndex(activeIndex, 0, highestUnlockedIndex);
  const activeSublecture = lecture.sublectures[currentIndex];
  const checkpoint = activeSublecture.checkpointAfter;
  const checkpointCompleted = checkpoint
    ? safeProgress.completedCheckpointIds.includes(checkpoint.id)
    : false;
  const checkpointFeedback = checkpoint
    ? safeProgress.activeCheckpointState[checkpoint.id]?.lastFeedback
    : undefined;

  const navItems = useMemo<LectureSectionNavItem[]>(() => {
    return lecture.sublectures.map((sublecture, index) => ({
      id: sublecture.id,
      title: sublecture.title,
      index,
      locked: index > highestUnlockedIndex,
      completed: index < highestUnlockedIndex || safeProgress.completedCheckpointIds.includes(sublecture.checkpointAfter?.id ?? ""),
      current: index === currentIndex,
    }));
  }, [currentIndex, highestUnlockedIndex, lecture, safeProgress.completedCheckpointIds]);

  const totalMilestones = lecture.sublectures.length + lecture.sublectures.filter((item) => item.checkpointAfter).length;
  const completedMilestones =
    Math.min(highestUnlockedIndex + 1, lecture.sublectures.length) +
    safeProgress.completedCheckpointIds.length;
  const progressPercent = Math.round((completedMilestones / totalMilestones) * 100);

  const handleSelectSection = (index: number) => {
    if (index > highestUnlockedIndex) {
      return;
    }

    setActiveIndex(index);
  };

  const handleVerifyCheckpoint = async (submission: any) => {
    if (!checkpoint) {
      return;
    }

    setIsVerifyingCheckpoint(true);
    try {
      const result = await verifyLectureCheckpoint(lecture.id, checkpoint.id, submission);
      const nextProgress: LectureProgress = {
        ...safeProgress,
        highestUnlockedSublectureIndex: Math.max(
          safeProgress.highestUnlockedSublectureIndex,
          result.newlyUnlockedSublectureIndex
        ),
        completedCheckpointIds: result.completedCheckpointIds,
        activeCheckpointState: {
          ...safeProgress.activeCheckpointState,
          [checkpoint.id]: {
            passed: result.passed,
            lastFeedback: result.feedback,
            lastAttemptedAt: new Date().toISOString(),
          },
        },
      };

      setProgress(nextProgress);
      await saveLectureProgress(nextProgress);

      if (result.passed) {
        setActiveIndex(
          clampIndex(result.newlyUnlockedSublectureIndex, 0, lecture.sublectures.length - 1)
        );
      }
    } finally {
      setIsVerifyingCheckpoint(false);
    }
  };

  const canAdvance = checkpointCompleted && currentIndex < lecture.sublectures.length - 1;

  return (
    <div className="lecture-page">
      <div className="lecture-page__container">
        <div className="lecture-topbar">
          <Link to="/library" className="lecture-back-button">
            <span aria-hidden="true">←</span>
            <span>Back</span>
          </Link>

          <div className="lecture-progress-shell">
            <div className="lecture-progress-shell__eyebrow">{category.title}</div>
            <div className="lecture-progress-shell__header">
              <div>
                <h1 className="lecture-progress-shell__title">{lecture.title}</h1>
                <div className="lecture-progress-shell__meta">
                  {lecture.estimatedMinutes} min lecture • {completedMilestones}/{totalMilestones} milestones completed
                </div>
              </div>
              <div className="lecture-badge">{progressPercent}% unlocked</div>
            </div>

            <div className="lecture-progress-track" aria-hidden="true">
              <div className="lecture-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="lecture-progress-caption">
              <span>{category.description}</span>
              <span>{isProgressLoading ? "Restoring saved progress..." : "Saved progress restored automatically"}</span>
            </div>
          </div>
        </div>

        <div className="lecture-mobile-nav">
          <select
            value={currentIndex}
            onChange={(event) => handleSelectSection(Number(event.target.value))}
          >
            {navItems.map((item) => (
              <option key={item.id} value={item.index} disabled={item.locked}>
                {item.locked ? "Locked • " : ""}
                {item.index + 1}. {item.title}
              </option>
            ))}
          </select>
        </div>

        <div className="lecture-layout">
          <aside className="lecture-sidebar">
            <div className="lecture-sidebar-card">
              <h2 className="lecture-sidebar-title">Table of contents</h2>
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`lecture-sidebar-item${item.current ? " is-current" : ""}${item.locked ? " is-locked" : ""}`}
                  disabled={item.locked}
                  onClick={() => handleSelectSection(item.index)}
                >
                  <span className="lecture-sidebar-index">{item.index + 1}</span>
                  <span className="lecture-sidebar-label">{item.title}</span>
                  <span className="lecture-sidebar-status">
                    {item.locked ? "Locked" : item.current ? "Open" : item.completed ? "Done" : "Ready"}
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <main className="lecture-content-card">
            <div className="lecture-content-meta">
              <span>{category.hero ?? category.description}</span>
              <span>Section {currentIndex + 1} of {lecture.sublectures.length}</span>
            </div>

            {progressError && <div className="lecture-inline-warning">{progressError}</div>}

            <MarkdownContent source={activeSublecture.contentSource} />

            {checkpoint && !checkpointCompleted && (
              <LectureMiniSandbox
                checkpoint={checkpoint}
                onVerify={handleVerifyCheckpoint}
                verificationFeedback={checkpointFeedback}
                isVerifying={isVerifyingCheckpoint}
              />
            )}

            {checkpointCompleted && (
              <div className="lecture-success-banner">
                {checkpointFeedback ?? "Checkpoint complete. The next sublecture is unlocked."}
                {canAdvance && (
                  <div>
                    <button type="button" onClick={() => handleSelectSection(currentIndex + 1)}>
                      Continue to the next sublecture
                    </button>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
