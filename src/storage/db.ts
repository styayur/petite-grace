import { openDB, type DBSchema } from "idb";
import type { Annotation } from "../annotations/types";
import type { AiResponse } from "../ai/types";
import type { ExerciseState } from "../exercises/types";
import type { CourseSnapshot } from "../platform/xiaoya/types";
import type { ReadingState } from "../reader/types";
import type { ReviewItem } from "../review/types";

export interface AppSetting {
  key: string;
  value: unknown;
}

export interface ProviderSecret {
  providerId: string;
  apiKey: string;
  updatedAt: string;
}

export interface AiCacheRecord {
  key: string;
  value: AiResponse;
  createdAt: string;
}

export interface PetiteGraceDB extends DBSchema {
  courses: { key: string; value: CourseSnapshot };
  readingStates: { key: string; value: ReadingState };
  annotations: {
    key: string;
    value: Annotation;
    indexes: { "by-document": string; "by-resource": string };
  };
  reviewItems: {
    key: string;
    value: ReviewItem;
    indexes: { "by-due": string; "by-resource": string };
  };
  settings: { key: string; value: AppSetting };
  providerSecrets: { key: string; value: ProviderSecret };
  aiCache: { key: string; value: AiCacheRecord };
  exerciseStates: {
    key: string;
    value: ExerciseState;
    indexes: { "by-resource": string };
  };
}

export const dbPromise = openDB<PetiteGraceDB>("petite-grace", 2, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      db.createObjectStore("courses", { keyPath: "courseId" });
      db.createObjectStore("readingStates", { keyPath: "documentId" });
      const annotations = db.createObjectStore("annotations", { keyPath: "id" });
      annotations.createIndex("by-document", "documentId");
      annotations.createIndex("by-resource", "resourceId");
      const reviews = db.createObjectStore("reviewItems", { keyPath: "id" });
      reviews.createIndex("by-due", "dueAt");
      reviews.createIndex("by-resource", "source.resourceId");
      db.createObjectStore("settings", { keyPath: "key" });
      db.createObjectStore("providerSecrets", { keyPath: "providerId" });
      db.createObjectStore("aiCache", { keyPath: "key" });
    }
    if (oldVersion < 2) {
      const exercises = db.createObjectStore("exerciseStates", { keyPath: "exerciseId" });
      exercises.createIndex("by-resource", "resourceId");
    }
  },
});
