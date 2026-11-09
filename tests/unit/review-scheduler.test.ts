import { describe, expect, it } from "vitest";
import { createReviewItem } from "../../src/review/factory";
import { dueReviews, reviewedToday, scheduleReview } from "../../src/review/scheduler";
import { parseReviewImport, serializeReviewItems } from "../../src/review/export";

const now = new Date("2026-11-10T08:00:00.000Z");

describe("review scheduler", () => {
  it("schedules a first good review for tomorrow", () => {
    const item = createReviewItem({ front: "Q", back: "A", source: { type: "manual" } });
    const next = scheduleReview(item, "good", now);
    expect(next.repetitions).toBe(1);
    expect(next.intervalDays).toBe(1);
    expect(next.dueAt).toBe("2026-11-11T08:00:00.000Z");
    expect(next.lastReviewedAt).toBe(now.toISOString());
  });

  it("brings an again card back in ten minutes and records a lapse", () => {
    const item = createReviewItem({ front: "Q", back: "A", source: { type: "manual" } });
    const next = scheduleReview({ ...item, repetitions: 3, intervalDays: 10 }, "again", now);
    expect(next.intervalDays).toBe(0);
    expect(next.lapses).toBe(1);
    expect(next.dueAt).toBe("2026-11-10T08:10:00.000Z");
  });

  it("filters due cards and counts reviews completed today", () => {
    const item = createReviewItem({ front: "Q", back: "A", source: { type: "manual" } });
    const reviewed = scheduleReview(item, "good", now);
    expect(dueReviews([reviewed], now)).toHaveLength(0);
    expect(reviewedToday([reviewed], now)).toBe(1);
  });
});

describe("review import/export", () => {
  it("round-trips review items", () => {
    const item = createReviewItem({ front: "Q", back: "A", source: { type: "manual" } });
    const parsed = parseReviewImport(serializeReviewItems([item]));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ id: item.id, front: "Q", back: "A" });
  });

  it("rejects unrelated JSON", () => {
    expect(() => parseReviewImport('{"items":[]}')).toThrow("不是 Petite Grace");
  });
});
