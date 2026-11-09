import type { Annotation } from "../annotations/types";
import type { CourseSnapshot } from "../platform/xiaoya/types";
import type { ReadingState } from "../reader/types";
import type { ReviewItem } from "../review/types";
import { dbPromise, type AppSetting } from "./db";

export const coursesRepository = {
  async get(courseId: string): Promise<CourseSnapshot | undefined> {
    return (await dbPromise).get("courses", courseId);
  },
  async put(course: CourseSnapshot): Promise<void> {
    await (await dbPromise).put("courses", course);
  },
  async clear(): Promise<void> {
    await (await dbPromise).clear("courses");
  },
};

export const readingRepository = {
  async get(documentId: string): Promise<ReadingState | undefined> {
    return (await dbPromise).get("readingStates", documentId);
  },
  async put(state: ReadingState): Promise<void> {
    await (await dbPromise).put("readingStates", state);
  },
};

export const annotationRepository = {
  async listByDocument(documentId: string): Promise<Annotation[]> {
    return (await dbPromise).getAllFromIndex("annotations", "by-document", documentId);
  },
  async put(annotation: Annotation): Promise<void> {
    await (await dbPromise).put("annotations", annotation);
  },
  async delete(id: string): Promise<void> {
    await (await dbPromise).delete("annotations", id);
  },
  async clear(): Promise<void> {
    await (await dbPromise).clear("annotations");
  },
};

export const reviewRepository = {
  async list(): Promise<ReviewItem[]> {
    return (await dbPromise).getAll("reviewItems");
  },
  async put(item: ReviewItem): Promise<void> {
    await (await dbPromise).put("reviewItems", item);
  },
  async delete(id: string): Promise<void> {
    await (await dbPromise).delete("reviewItems", id);
  },
  async clear(): Promise<void> {
    await (await dbPromise).clear("reviewItems");
  },
};

export const settingsRepository = {
  async get<T>(key: string, fallback: T): Promise<T> {
    const record = await (await dbPromise).get("settings", key);
    return record ? (record.value as T) : fallback;
  },
  async put(key: string, value: unknown): Promise<void> {
    const setting: AppSetting = { key, value };
    await (await dbPromise).put("settings", setting);
  },
  async clear(): Promise<void> {
    await (await dbPromise).clear("settings");
  },
};

export async function clearAllLocalData(): Promise<void> {
  const db = await dbPromise;
  await Promise.all([
    db.clear("courses"),
    db.clear("readingStates"),
    db.clear("annotations"),
    db.clear("reviewItems"),
    db.clear("settings"),
    db.clear("providerSecrets"),
    db.clear("aiCache"),
  ]);
}
