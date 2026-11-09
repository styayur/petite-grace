import { describe, expect, it } from "vitest";
import {
  createAnnotation,
  normalizeText,
  parseAnnotationsImport,
  serializeAnnotations,
} from "../../src/annotations/service";

describe("annotation data", () => {
  it("creates and round-trips annotation exports", () => {
    const annotation = createAnnotation({
      documentId: "course:resource",
      courseId: "course",
      resourceId: "resource",
      page: 2,
      text: "Important quote",
      note: "Review this",
      rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.04 }],
      color: "blue",
    });
    const parsed = parseAnnotationsImport(serializeAnnotations([annotation]));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ id: annotation.id, color: "blue", page: 2 });
  });

  it("rejects unrelated JSON", () => {
    expect(() => parseAnnotationsImport('{"annotations":[]}')).toThrow("不是 Petite Grace");
  });

  it("normalizes whitespace for quote matching", () => {
    expect(normalizeText("  one\n two\tthree ")).toBe("one two three");
  });
});
