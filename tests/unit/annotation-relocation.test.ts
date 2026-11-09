import { describe, expect, it } from "vitest";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Annotation } from "../../src/annotations/types";
import { createAnnotation, reanchorAnnotations } from "../../src/annotations/service";

function fakePdf(pages: string[]): PDFDocumentProxy {
  return {
    numPages: pages.length,
    getPage: async (pageNumber: number) => ({
      getTextContent: async () => ({
        items: [{ str: pages[pageNumber - 1] ?? "" }],
      }),
    }),
  } as unknown as PDFDocumentProxy;
}

function annotationFor(text: string, page: number): Annotation {
  return createAnnotation({
    documentId: "doc",
    courseId: "course",
    resourceId: "resource",
    page,
    text,
    rects: [{ x: 0, y: 0, width: 0.1, height: 0.1 }],
  });
}

describe("annotation relocation", () => {
  it("finds a quote on a later page and marks its new page", async () => {
    const updates = await reanchorAnnotations(fakePdf(["intro", "moved quote"]), [
      annotationFor("moved quote", 1),
    ]);
    expect(updates).toEqual([{ id: expect.any(String), page: 2, needsRelocation: false }]);
  });

  it("keeps unmatched annotations and marks them for relocation", async () => {
    const updates = await reanchorAnnotations(fakePdf(["intro", "other"]), [
      annotationFor("missing quote", 1),
    ]);
    expect(updates).toEqual([{ id: expect.any(String), page: 1, needsRelocation: true }]);
  });
});
