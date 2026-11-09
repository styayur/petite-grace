import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { createAnnotation } from "../../src/annotations/service";
import { courseFixture } from "../fixtures/course";
import {
  annotationRepository,
  clearAllLocalData,
  coursesRepository,
  readingRepository,
} from "../../src/storage/repositories";

describe("IndexedDB repositories", () => {
  beforeEach(async () => {
    await clearAllLocalData();
    await coursesRepository.put(courseFixture);
  });

  it("restores a cached course snapshot", async () => {
    const cached = await coursesRepository.get(courseFixture.courseId);
    expect(cached?.title).toBe(courseFixture.title);
    expect(cached?.chapters).toHaveLength(courseFixture.chapters.length);
  });

  it("persists reading state", async () => {
    await readingRepository.put({
      documentId: "course:resource",
      page: 7,
      relativeScroll: 0.2,
      scale: 1.25,
      layout: "double",
      zoomMode: "custom",
      updatedAt: new Date().toISOString(),
    });
    expect(await readingRepository.get("course:resource")).toMatchObject({
      page: 7,
      layout: "double",
    });
  });

  it("lists and deletes annotations by document", async () => {
    const annotation = createAnnotation({
      documentId: "course:resource",
      courseId: "course",
      resourceId: "resource",
      page: 1,
      text: "quote",
      rects: [],
    });
    await annotationRepository.put(annotation);
    expect(await annotationRepository.listByDocument("course:resource")).toHaveLength(1);
    await annotationRepository.delete(annotation.id);
    expect(await annotationRepository.listByDocument("course:resource")).toHaveLength(0);
  });
});
