export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface ReviewItem {
  id: string;
  front: string;
  back: string;
  source: {
    type: "annotation" | "exercise" | "manual";
    courseId?: string;
    resourceId?: string;
    annotationId?: string;
    page?: number;
  };
  createdAt: string;
  updatedAt: string;
  dueAt: string;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  lastReviewedAt?: string;
}
