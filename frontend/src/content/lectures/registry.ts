import foundationsLecture from "./foundations/market-graph-basics/metadata";
import type {
  LectureCatalogCategory,
  LectureCatalogResponse,
  LectureCategory,
  LectureDefinition,
} from "../../features/lectures/types";

const lectureCategories: LectureCategory[] = [
  {
    slug: "foundations",
    title: "Foundations",
    description: "Start with the structure of SEND lectures, the flow of gated sublectures, and the first graph-building patterns.",
    hero: "Category-driven learning paths with unlockable checkpoints.",
  },
];

const lectureDefinitions: LectureDefinition[] = [foundationsLecture];

export function getLectureDefinitions(): LectureDefinition[] {
  return lectureDefinitions;
}

export function getLectureDefinition(categorySlug: string, lectureSlug: string): LectureDefinition | undefined {
  return lectureDefinitions.find(
    (lecture) => lecture.categorySlug === categorySlug && lecture.slug === lectureSlug
  );
}

export function getLectureCatalog(): LectureCatalogResponse {
  const categories: LectureCatalogCategory[] = lectureCategories.map((category) => ({
    ...category,
    lectures: lectureDefinitions
      .filter((lecture) => lecture.categorySlug === category.slug)
      .map((lecture) => ({
        id: lecture.id,
        slug: lecture.slug,
        categorySlug: lecture.categorySlug,
        title: lecture.title,
        summary: lecture.summary,
        estimatedMinutes: lecture.estimatedMinutes,
      })),
  }));

  return { categories };
}

export function getLectureCategory(slug: string): LectureCategory | undefined {
  return lectureCategories.find((category) => category.slug === slug);
}
