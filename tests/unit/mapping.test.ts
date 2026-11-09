import { describe, expect, it } from "vitest";
import { inferResourceKind, mapCourseSnapshot } from "../../src/platform/xiaoya/mapping";
import { rawCourseFixture } from "../fixtures/course";

describe("course mapping", () => {
  it("preserves chapter hierarchy and resources", () => {
    const course = mapCourseSnapshot({
      courseId: "course-1",
      visit: { name: "Course", site_id: 1 },
      resources: rawCourseFixture,
      source: "fixture",
    });

    expect(course.title).toBe("Course");
    expect(course.rootChapterIds).toEqual(["1001", "1003"]);
    expect(course.chapters.find((chapter) => chapter.id === "1002")?.parentId).toBe("1001");
    expect(course.chapters.find((chapter) => chapter.id === "1002")?.resourceIds).toEqual([
      "2001",
      "2002",
    ]);
    expect(course.orphanResourceIds).toEqual(["2005"]);
  });

  it("uses an explicit order field when present", () => {
    const course = mapCourseSnapshot({
      courseId: "course-2",
      resources: [
        { id: "a", name: "A", type: "folder", sort: 2 },
        { id: "b", name: "B", type: "folder", sort: 1 },
      ],
    });
    expect(course.rootChapterIds).toEqual(["b", "a"]);
    expect(course.sortEvidence).toBe("explicit-order-field");
  });

  it("falls back to source order instead of sorting by filename", () => {
    const course = mapCourseSnapshot({
      courseId: "course-3",
      resources: [
        { id: "10", name: "chapter-ten", type: "folder" },
        { id: "2", name: "chapter-two", type: "folder" },
      ],
    });
    expect(course.rootChapterIds).toEqual(["10", "2"]);
    expect(course.sortEvidence).toBe("source-order-fallback");
  });

  it("classifies common resource types", () => {
    expect(inferResourceKind("application/pdf", "a.bin")).toBe("pdf");
    expect(inferResourceKind(null, "slides.pptx")).toBe("presentation");
    expect(inferResourceKind(null, "photo.webp")).toBe("image");
    expect(inferResourceKind(null, "homework", { is_exercise: true })).toBe("exercise");
  });
});
