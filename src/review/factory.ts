import type { ReviewItem } from "./types";

export function createReviewItem(input: {
  front: string;
  back: string;
  source: ReviewItem["source"];
}): ReviewItem {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    front: input.front.trim(),
    back: input.back.trim(),
    source: input.source,
    createdAt: now,
    updatedAt: now,
    dueAt: now,
    intervalDays: 0,
    easeFactor: 2.5,
    repetitions: 0,
    lapses: 0,
  };
}
