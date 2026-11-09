import type { ReviewItem, ReviewRating } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;

export function scheduleReview(
  item: ReviewItem,
  rating: ReviewRating,
  now: Date = new Date(),
): ReviewItem {
  let intervalDays = item.intervalDays;
  let easeFactor = item.easeFactor;
  let repetitions = item.repetitions;
  let lapses = item.lapses;
  let dueAt: string;

  if (rating === "again") {
    repetitions = 0;
    lapses += 1;
    intervalDays = 0;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
    dueAt = new Date(now.getTime() + TEN_MINUTES_MS).toISOString();
  } else {
    if (rating === "hard") {
      easeFactor = Math.max(1.3, easeFactor - 0.15);
      intervalDays = repetitions === 0 ? 1 : Math.max(1, intervalDays * 1.2);
    } else if (rating === "good") {
      intervalDays =
        repetitions === 0 ? 1 : repetitions === 1 ? 3 : Math.max(1, intervalDays * easeFactor);
    } else {
      easeFactor = Math.min(2.8, easeFactor + 0.15);
      intervalDays = repetitions === 0 ? 3 : Math.max(1, intervalDays * easeFactor * 1.3);
    }
    repetitions += 1;
    dueAt = new Date(now.getTime() + intervalDays * DAY_MS).toISOString();
  }

  return {
    ...item,
    intervalDays,
    easeFactor,
    repetitions,
    lapses,
    dueAt,
    lastReviewedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function isReviewDue(item: ReviewItem, now: Date = new Date()): boolean {
  return new Date(item.dueAt).getTime() <= now.getTime();
}

export function dueReviews(items: ReviewItem[], now: Date = new Date()): ReviewItem[] {
  return items
    .filter((item) => isReviewDue(item, now))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function reviewedToday(items: ReviewItem[], now: Date = new Date()): number {
  const day = now.toISOString().slice(0, 10);
  return items.filter((item) => item.lastReviewedAt?.slice(0, 10) === day).length;
}
