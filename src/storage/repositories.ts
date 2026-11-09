import type { Annotation } from "../annotations/types";
import type { ExerciseState } from "../exercises/types";
import type { CourseSnapshot } from "../platform/xiaoya/types";
import type { ReadingState } from "../reader/types";
import type { ReviewItem } from "../review/types";
import { dbPromise, type AppSetting, type AiCacheRecord, type ProviderSecret } from "./db";

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

export const exerciseRepository = {
  async listByResource(resourceId: string): Promise<ExerciseState[]> {
    return (await dbPromise).getAllFromIndex("exerciseStates", "by-resource", resourceId);
  },
  async put(state: ExerciseState): Promise<void> {
    await (await dbPromise).put("exerciseStates", state);
  },
};

export const providerSecretRepository = {
  async get(providerId: string): Promise<string | null> {
    const record = await (await dbPromise).get("providerSecrets", providerId);
    return record?.apiKey ?? null;
  },
  async put(secret: ProviderSecret): Promise<void> {
    await (await dbPromise).put("providerSecrets", secret);
  },
  async delete(providerId: string): Promise<void> {
    await (await dbPromise).delete("providerSecrets", providerId);
  },
};

export const aiCacheRepository = {
  async get(key: string): Promise<AiCacheRecord | undefined> {
    return (await dbPromise).get("aiCache", key);
  },
  async put(record: AiCacheRecord): Promise<void> {
    await (await dbPromise).put("aiCache", record);
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
    db.clear("exerciseStates"),
  ]);
}
