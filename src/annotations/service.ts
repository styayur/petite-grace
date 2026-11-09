import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Annotation, HighlightRect } from "./types";

export const ANNOTATION_EXPORT_VERSION = 1;

export interface AnnotationInput {
  documentId: string;
  courseId: string;
  resourceId: string;
  page: number;
  text: string;
  note?: string;
  color?: Annotation["color"];
  rects: HighlightRect[];
  contextBefore?: string;
  contextAfter?: string;
}

export function annotationDocumentId(courseId: string, resourceId: string): string {
  return `${courseId}:${resourceId}`;
}

export function createAnnotation(input: AnnotationInput): Annotation {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    documentId: input.documentId,
    courseId: input.courseId,
    resourceId: input.resourceId,
    page: input.page,
    text: input.text,
    note: input.note ?? "",
    color: input.color ?? "yellow",
    rects: input.rects,
    contextBefore: input.contextBefore ?? "",
    contextAfter: input.contextAfter ?? "",
    needsRelocation: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export async function reanchorAnnotations(
  document: PDFDocumentProxy,
  annotations: Annotation[],
): Promise<Array<{ id: string; page: number; needsRelocation: boolean }>> {
  const textCache = new Map<number, string>();
  const textForPage = async (pageNumber: number): Promise<string> => {
    const cached = textCache.get(pageNumber);
    if (cached !== undefined) return cached;
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = normalizeText(
      content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
    );
    textCache.set(pageNumber, text);
    return text;
  };

  const updates: Array<{ id: string; page: number; needsRelocation: boolean }> = [];
  for (const annotation of annotations) {
    const quote = normalizeText(annotation.text);
    if (!quote) continue;
    const originalPage = Math.min(Math.max(annotation.page, 1), document.numPages);
    if ((await textForPage(originalPage)).includes(quote)) continue;
    let relocatedPage: number | null = null;
    for (let page = 1; page <= document.numPages; page += 1) {
      if (page === originalPage) continue;
      if ((await textForPage(page)).includes(quote)) {
        relocatedPage = page;
        break;
      }
    }
    updates.push({
      id: annotation.id,
      page: relocatedPage ?? originalPage,
      needsRelocation: relocatedPage === null,
    });
  }
  return updates;
}

export function serializeAnnotations(annotations: Annotation[]): string {
  return JSON.stringify(
    {
      app: "petite-grace",
      version: ANNOTATION_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      annotations,
    },
    null,
    2,
  );
}

function isRect(value: unknown): value is HighlightRect {
  if (!value || typeof value !== "object") return false;
  const rect = value as Record<string, unknown>;
  return ["x", "y", "width", "height"].every(
    (key) => typeof rect[key] === "number" && Number.isFinite(rect[key]),
  );
}

export function parseAnnotationsImport(json: string): Annotation[] {
  const parsed = JSON.parse(json) as unknown;
  if (!parsed || typeof parsed !== "object") throw new Error("标注文件格式无效");
  const record = parsed as Record<string, unknown>;
  if (record.app !== "petite-grace" || !Array.isArray(record.annotations)) {
    throw new Error("不是 Petite Grace 标注导出文件");
  }
  return record.annotations.map((value, index) => {
    if (!value || typeof value !== "object") throw new Error(`第 ${index + 1} 条标注无效`);
    const annotation = value as Record<string, unknown>;
    const required = ["id", "documentId", "courseId", "resourceId", "text"];
    for (const key of required) {
      if (typeof annotation[key] !== "string" || !annotation[key]) {
        throw new Error(`第 ${index + 1} 条标注缺少 ${key}`);
      }
    }
    if (!Number.isFinite(annotation.page) || !Array.isArray(annotation.rects)) {
      throw new Error(`第 ${index + 1} 条标注位置无效`);
    }
    const color = annotation.color;
    if (!["yellow", "blue", "green", "pink"].includes(String(color))) {
      throw new Error(`第 ${index + 1} 条标注颜色无效`);
    }
    return {
      id: String(annotation.id),
      documentId: String(annotation.documentId),
      courseId: String(annotation.courseId),
      resourceId: String(annotation.resourceId),
      page: Math.max(1, Math.round(Number(annotation.page))),
      text: String(annotation.text),
      note: typeof annotation.note === "string" ? annotation.note : "",
      color: color as Annotation["color"],
      rects: annotation.rects.filter(isRect),
      contextBefore: typeof annotation.contextBefore === "string" ? annotation.contextBefore : "",
      contextAfter: typeof annotation.contextAfter === "string" ? annotation.contextAfter : "",
      needsRelocation: Boolean(annotation.needsRelocation),
      createdAt:
        typeof annotation.createdAt === "string" ? annotation.createdAt : new Date().toISOString(),
      updatedAt:
        typeof annotation.updatedAt === "string" ? annotation.updatedAt : new Date().toISOString(),
    };
  });
}
