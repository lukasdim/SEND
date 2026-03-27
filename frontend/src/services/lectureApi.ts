import { getLectureCatalog, getLectureDefinition, getLectureDefinitions } from "../content/lectures/registry";
import type {
  LectureCatalogResponse,
  LectureCheckpointRequirement,
  LectureCheckpointSubmission,
  LectureCheckpointVerificationResult,
  LectureDefinition,
  LectureProgress,
  LectureSandboxNodeType,
} from "../features/lectures/types";

const LECTURE_PROGRESS_STORAGE_KEY = "send:lecture-progress:v1";

function delay<T>(value: T, timeoutMs = 220): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), timeoutMs);
  });
}

function buildDefaultProgress(lectureId: string): LectureProgress {
  return {
    lectureId,
    highestUnlockedSublectureIndex: 0,
    completedCheckpointIds: [],
    activeCheckpointState: {},
  };
}

function readProgressStore(): Record<string, LectureProgress> {
  if (typeof window === "undefined") {
    return {};
  }

  const rawValue = window.localStorage.getItem(LECTURE_PROGRESS_STORAGE_KEY);
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed as Record<string, LectureProgress>;
  } catch {
    return {};
  }
}

function writeProgressStore(store: Record<string, LectureProgress>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LECTURE_PROGRESS_STORAGE_KEY, JSON.stringify(store));
}

function updateStoredLectureProgress(
  lectureId: string,
  updater: (current: LectureProgress) => LectureProgress
): LectureProgress {
  const store = readProgressStore();
  const current = store[lectureId] ?? buildDefaultProgress(lectureId);
  const next = updater(current);
  store[lectureId] = next;
  writeProgressStore(store);
  return next;
}

function hasNodeType(
  submission: LectureCheckpointSubmission,
  nodeType: LectureSandboxNodeType
): boolean {
  return submission.nodes.some((node) => node.type === nodeType);
}

function hasConnection(
  submission: LectureCheckpointSubmission,
  sourceType: LectureSandboxNodeType,
  targetType: LectureSandboxNodeType
): boolean {
  return submission.edges.some((edge) => {
    const sourceNode = submission.nodes.find((node) => node.id === edge.source);
    const targetNode = submission.nodes.find((node) => node.id === edge.target);
    return sourceNode?.type === sourceType && targetNode?.type === targetType;
  });
}

function requirementSatisfied(
  requirement: LectureCheckpointRequirement,
  submission: LectureCheckpointSubmission
): boolean {
  if (requirement.type === "node_present") {
    return hasNodeType(submission, requirement.nodeType);
  }

  return hasConnection(submission, requirement.sourceType, requirement.targetType);
}

function getCheckpointContext(lectureId: string, checkpointId: string) {
  const lecture = getLectureDefinitions().find((candidate) => candidate.id === lectureId);
  if (!lecture) {
    return null;
  }

  const sublectureIndex = lecture.sublectures.findIndex(
    (sublecture) => sublecture.checkpointAfter?.id === checkpointId
  );
  if (sublectureIndex < 0) {
    return null;
  }

  const checkpoint = lecture.sublectures[sublectureIndex]?.checkpointAfter;
  if (!checkpoint) {
    return null;
  }

  return {
    lecture,
    checkpoint,
    sublectureIndex,
  };
}

export async function fetchLectureCatalog(): Promise<LectureCatalogResponse> {
  return delay(getLectureCatalog());
}

export async function fetchLecture(lectureId: string): Promise<LectureDefinition> {
  const lecture = getLectureDefinitions().find((candidate) => candidate.id === lectureId);
  if (!lecture) {
    throw new Error("Lecture not found.");
  }

  return delay(lecture);
}

export async function fetchLectureBySlug(
  categorySlug: string,
  lectureSlug: string
): Promise<LectureDefinition> {
  const lecture = getLectureDefinition(categorySlug, lectureSlug);
  if (!lecture) {
    throw new Error("Lecture not found.");
  }

  return delay(lecture);
}

export async function fetchLectureProgress(lectureId: string): Promise<LectureProgress> {
  return delay(readProgressStore()[lectureId] ?? buildDefaultProgress(lectureId));
}

export async function saveLectureProgress(progress: LectureProgress): Promise<LectureProgress> {
  return delay(
    updateStoredLectureProgress(progress.lectureId, () => ({
      ...progress,
      completedCheckpointIds: [...new Set(progress.completedCheckpointIds)],
    }))
  );
}

export async function verifyLectureCheckpoint(
  lectureId: string,
  checkpointId: string,
  submission: LectureCheckpointSubmission
): Promise<LectureCheckpointVerificationResult> {
  const checkpointContext = getCheckpointContext(lectureId, checkpointId);
  if (!checkpointContext) {
    throw new Error("Checkpoint not found.");
  }

  const { checkpoint, sublectureIndex } = checkpointContext;
  const passed = checkpoint.sandboxPreset.requirements.every((requirement) =>
    requirementSatisfied(requirement, submission)
  );

  const feedback = passed
    ? "Checkpoint verified. The next sublecture is now unlocked."
    : "The checkpoint is not complete yet. Add the required nodes and connections, then try again.";

  const progress = updateStoredLectureProgress(lectureId, (current) => {
    const completedCheckpointIds = passed
      ? [...new Set([...current.completedCheckpointIds, checkpointId])]
      : current.completedCheckpointIds;

    return {
      ...current,
      highestUnlockedSublectureIndex: passed
        ? Math.max(current.highestUnlockedSublectureIndex, sublectureIndex + 1)
        : current.highestUnlockedSublectureIndex,
      completedCheckpointIds,
      activeCheckpointState: {
        ...current.activeCheckpointState,
        [checkpointId]: {
          passed,
          lastFeedback: feedback,
          lastAttemptedAt: new Date().toISOString(),
        },
      },
    };
  });

  return delay({
    passed,
    feedback,
    newlyUnlockedSublectureIndex: progress.highestUnlockedSublectureIndex,
    completedCheckpointIds: progress.completedCheckpointIds,
  });
}
