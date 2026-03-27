export type LectureCategory = {
  slug: string;
  title: string;
  description: string;
  hero?: string;
};

export type LectureSandboxNodeType = string;

export type LectureSandboxNode = {
  id: string;
  type: LectureSandboxNodeType;
  label?: string;
  position: {
    x: number;
    y: number;
  };
};

export type LectureSandboxEdge = {
  id: string;
  source: string;
  target: string;
};

export type LectureCheckpointTask = {
  id: string;
  label: string;
  description: string;
};

export type LectureCheckpointRequirement =
  | {
      type: "node_present";
      nodeType: LectureSandboxNodeType;
    }
  | {
      type: "connection_present";
      sourceType: LectureSandboxNodeType;
      targetType: LectureSandboxNodeType;
    };

export type LectureSandboxPreset = {
  allowedNodeTypes: LectureSandboxNodeType[];
  starterNodes: LectureSandboxNode[];
  starterEdges: LectureSandboxEdge[];
  requirements: LectureCheckpointRequirement[];
};

export type CheckpointDefinition = {
  id: string;
  title: string;
  instructions: string[];
  tasks: LectureCheckpointTask[];
  sandboxPreset: LectureSandboxPreset;
};

export type SublectureDefinition = {
  id: string;
  title: string;
  contentSource: string;
  checkpointAfter?: CheckpointDefinition;
};

export type LectureDefinition = {
  id: string;
  slug: string;
  categorySlug: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  sublectures: SublectureDefinition[];
};

export type LectureCatalogItem = Pick<
  LectureDefinition,
  "id" | "slug" | "categorySlug" | "title" | "summary" | "estimatedMinutes"
>;

export type LectureCatalogCategory = LectureCategory & {
  lectures: LectureCatalogItem[];
};

export type LectureCatalogResponse = {
  categories: LectureCatalogCategory[];
};

export type LectureCheckpointSubmission = {
  nodes: LectureSandboxNode[];
  edges: LectureSandboxEdge[];
};

export type LectureCheckpointVerificationResult = {
  passed: boolean;
  feedback: string;
  newlyUnlockedSublectureIndex: number;
  completedCheckpointIds: string[];
};

export type LectureProgress = {
  lectureId: string;
  highestUnlockedSublectureIndex: number;
  completedCheckpointIds: string[];
  activeCheckpointState: Record<
    string,
    {
      lastFeedback?: string;
      lastAttemptedAt?: string;
      passed: boolean;
    }
  >;
};

export type LectureSectionNavItem = {
  id: string;
  title: string;
  index: number;
  locked: boolean;
  completed: boolean;
  current: boolean;
};
