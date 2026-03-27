import type {
  LectureCatalogResponse,
  LectureCheckpointSubmission,
  LectureCheckpointVerificationResult,
  LectureDetailResponse,
  LectureProgress,
} from "../features/lectures/types";

const API_URL = import.meta.env.VITE_API_URL?.trim() || "";

type LectureProgressStatePayload = {
  lastFeedback?: string | null;
  lastAttemptedAt?: string | null;
  passed: boolean;
};

type LectureProgressPayload = {
  lectureId: string;
  highestUnlockedSublectureIndex: number;
  completedCheckpointIds: string[];
  activeCheckpointState: Record<string, LectureProgressStatePayload>;
};

function toLectureProgress(payload: LectureProgressPayload): LectureProgress {
  return {
    lectureId: payload.lectureId,
    highestUnlockedSublectureIndex: payload.highestUnlockedSublectureIndex,
    completedCheckpointIds: payload.completedCheckpointIds,
    activeCheckpointState: Object.fromEntries(
      Object.entries(payload.activeCheckpointState ?? {}).map(([checkpointId, state]) => [
        checkpointId,
        {
          lastFeedback: state.lastFeedback ?? undefined,
          lastAttemptedAt: state.lastAttemptedAt ?? undefined,
          passed: state.passed,
        },
      ])
    ),
  };
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Lecture request failed (${response.status})`;
    try {
      const errorPayload = (await response.json()) as { message?: unknown };
      if (typeof errorPayload.message === "string" && errorPayload.message.length > 0) {
        message = errorPayload.message;
      }
    } catch {
      // Ignore malformed error bodies and fall back to the status-based message.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function fetchLectureCatalog(): Promise<LectureCatalogResponse> {
  const response = await fetch(`${API_URL}/api/lectures`, {
    method: "GET",
    credentials: "include",
  });

  return readJson<LectureCatalogResponse>(response);
}

export async function fetchLecture(lectureId: string): Promise<LectureDetailResponse> {
  const [categorySlug, lectureSlug] = lectureId.split("--", 2);
  if (!categorySlug || !lectureSlug) {
    throw new Error("Lecture id is malformed.");
  }

  return fetchLectureBySlug(categorySlug, lectureSlug);
}

export async function fetchLectureBySlug(
  categorySlug: string,
  lectureSlug: string
): Promise<LectureDetailResponse> {
  const response = await fetch(`${API_URL}/api/lectures/${encodeURIComponent(categorySlug)}/${encodeURIComponent(lectureSlug)}`, {
    method: "GET",
    credentials: "include",
  });

  const payload = await readJson<LectureDetailResponse & { progress: LectureProgressPayload }>(response);
  return {
    ...payload,
    progress: toLectureProgress(payload.progress),
  };
}

export async function fetchLectureProgress(lectureId: string): Promise<LectureProgress> {
  const response = await fetch(`${API_URL}/api/lectures/${encodeURIComponent(lectureId)}/progress`, {
    method: "GET",
    credentials: "include",
  });

  return toLectureProgress(await readJson<LectureProgressPayload>(response));
}

export async function saveLectureProgress(progress: LectureProgress): Promise<LectureProgress> {
  const response = await fetch(`${API_URL}/api/lectures/${encodeURIComponent(progress.lectureId)}/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(progress),
  });

  return toLectureProgress(await readJson<LectureProgressPayload>(response));
}

export async function verifyLectureCheckpoint(
  lectureId: string,
  checkpointId: string,
  submission: LectureCheckpointSubmission
): Promise<LectureCheckpointVerificationResult> {
  const response = await fetch(
    `${API_URL}/api/lectures/${encodeURIComponent(lectureId)}/checkpoints/${encodeURIComponent(checkpointId)}/verify`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(submission),
    }
  );

  return readJson<LectureCheckpointVerificationResult>(response);
}
