import type { ReviewItem } from "./types";

export const REVIEW_EXPORT_VERSION = 1;

export function serializeReviewItems(items: ReviewItem[]): string {
  return JSON.stringify(
    {
      app: "petite-grace",
      version: REVIEW_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      reviewItems: items,
    },
    null,
    2,
  );
}

export function parseReviewImport(json: string): ReviewItem[] {
  const parsed = JSON.parse(json) as unknown;
  if (!parsed || typeof parsed !== "object") throw new Error("复习文件格式无效");
  const record = parsed as Record<string, unknown>;
  if (record.app !== "petite-grace" || !Array.isArray(record.reviewItems)) {
    throw new Error("不是 Petite Grace 复习导出文件");
  }
  return record.reviewItems.map((value, index) => {
    if (!value || typeof value !== "object") throw new Error(`第 ${index + 1} 条复习项目无效`);
    const item = value as Record<string, unknown>;
    for (const key of ["id", "front", "back", "dueAt", "createdAt", "updatedAt"]) {
      if (typeof item[key] !== "string" || !item[key])
        throw new Error(`第 ${index + 1} 条复习项目缺少 ${key}`);
    }
    return {
      id: String(item.id),
      front: String(item.front),
      back: String(item.back),
      source: (item.source ?? { type: "manual" }) as ReviewItem["source"],
      createdAt: String(item.createdAt),
      updatedAt: String(item.updatedAt),
      dueAt: String(item.dueAt),
      intervalDays: Number(item.intervalDays ?? 0),
      easeFactor: Number(item.easeFactor ?? 2.5),
      repetitions: Number(item.repetitions ?? 0),
      lapses: Number(item.lapses ?? 0),
      lastReviewedAt: typeof item.lastReviewedAt === "string" ? item.lastReviewedAt : undefined,
    };
  });
}
