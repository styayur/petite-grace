import type {
  ChapterNode,
  CourseSnapshot,
  ResourceKind,
  ResourceRecord,
  XiaoyaVisitData,
} from "./types";

type RawRecord = Record<string, unknown>;

const ORDER_FIELDS = [
  "display_order",
  "displayOrder",
  "sort",
  "sort_num",
  "sortNum",
  "sequence",
  "seq",
  "order",
  "order_num",
  "index",
];

const CHAPTER_TYPES = new Set([
  "chapter",
  "folder",
  "catalog",
  "directory",
  "section",
  "module",
  "unit",
]);

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function parseOrder(record: RawRecord): number | null {
  for (const field of ORDER_FIELDS) {
    const value = record[field];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())) {
      return Number(value);
    }
  }
  return null;
}

function recordId(record: RawRecord, key: string): string {
  return (
    asString(record.id) ??
    asString(record.resource_id) ??
    asString(record.resourceId) ??
    asString(record.node_id) ??
    asString(record.nodeId) ??
    asString(record.courseware_id) ??
    key
  );
}

function recordTitle(record: RawRecord, fallback: string): string {
  return (
    asString(record.name) ??
    asString(record.title) ??
    asString(record.resource_name) ??
    asString(record.resourceName) ??
    asString(record.file_name) ??
    asString(record.fileName) ??
    fallback
  );
}

function recordParentId(record: RawRecord): string | null {
  return (
    asString(record.parent_id) ??
    asString(record.parentId) ??
    asString(record.pid) ??
    asString(record.chapter_id) ??
    asString(record.chapterId) ??
    null
  );
}

function recordMime(record: RawRecord): string | null {
  return (
    asString(record.mimetype) ??
    asString(record.mime_type) ??
    asString(record.mimeType) ??
    asString(record.content_type) ??
    null
  );
}

function extensionOf(title: string): string {
  const match = /\.([a-z0-9]{1,8})$/i.exec(title);
  return match?.[1]?.toLowerCase() ?? "";
}

export function inferResourceKind(
  mimeType: string | null,
  title: string,
  record: RawRecord = {},
): ResourceKind {
  const mime = mimeType?.toLowerCase() ?? "";
  const ext = extensionOf(title);
  const typeText =
    `${asString(record.type) ?? ""} ${asString(record.resource_type) ?? ""}`.toLowerCase();

  if (asBoolean(record.is_exercise) || /exercise|homework|assignment|survey|quiz/.test(typeText)) {
    return "exercise";
  }
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (
    mime.includes("presentation") ||
    mime.includes("powerpoint") ||
    ["ppt", "pptx", "odp"].includes(ext)
  ) {
    return "presentation";
  }
  if (
    mime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)
  ) {
    return "image";
  }
  if (
    mime.startsWith("video/") ||
    /\bvideo\b/.test(typeText) ||
    Boolean(record.video_id || record.videoId) ||
    ["mp4", "webm", "mov", "mkv", "m4v"].includes(ext)
  ) {
    return "video";
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  if (
    mime.includes("word") ||
    mime.includes("text") ||
    mime.includes("excel") ||
    mime.includes("spreadsheet") ||
    ["doc", "docx", "txt", "md", "rtf", "odt", "xls", "xlsx", "csv"].includes(ext)
  ) {
    return "document";
  }
  return "unknown";
}

function isChapterRecord(record: RawRecord, hasChildren: boolean): boolean {
  if (asBoolean(record.is_chapter) || asBoolean(record.isChapter)) return true;
  if (asBoolean(record.is_folder) || asBoolean(record.isFolder)) return true;
  const typeText =
    `${asString(record.type) ?? ""} ${asString(record.node_type) ?? ""}`.toLowerCase();
  if (CHAPTER_TYPES.has(typeText.trim())) return true;
  if (Array.from(CHAPTER_TYPES).some((type) => typeText.includes(type))) return true;
  if (hasChildren && !recordMime(record) && !asString(record.quote_id)) return true;
  return false;
}

function normalizeRecords(input: unknown): Array<{ key: string; record: RawRecord }> {
  if (Array.isArray(input)) {
    return input
      .filter((item): item is RawRecord => Boolean(item) && typeof item === "object")
      .map((record, index) => ({ key: String(index), record }));
  }
  if (input && typeof input === "object") {
    const object = input as Record<string, unknown>;
    const directValues = Object.values(object).filter(
      (item): item is RawRecord =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item),
    );
    const nestedData = object.data;
    if (directValues.length === 0 && nestedData) return normalizeRecords(nestedData);
    return Object.entries(object).flatMap(([key, value]) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      return [{ key, record: value as RawRecord }];
    });
  }
  return [];
}

function compareByOrder<T extends { displayOrder: number; sourceIndex: number; id: string }>(
  a: T,
  b: T,
): number {
  return (
    a.displayOrder - b.displayOrder || a.sourceIndex - b.sourceIndex || a.id.localeCompare(b.id)
  );
}

export function mapCourseSnapshot(input: {
  courseId: string;
  visit?: XiaoyaVisitData | null;
  resources: unknown;
  fetchedAt?: string;
  source?: "live" | "fixture";
}): CourseSnapshot {
  const rawEntries = normalizeRecords(input.resources);
  const rawById = new Map<string, RawRecord>();
  const sourceIndexById = new Map<string, number>();
  const parentById = new Map<string, string | null>();
  const childCount = new Map<string, number>();

  rawEntries.forEach(({ key, record }, sourceIndex) => {
    const id = recordId(record, key);
    if (!rawById.has(id)) {
      rawById.set(id, record);
      sourceIndexById.set(id, sourceIndex);
    }
    const parentId = recordParentId(record);
    parentById.set(id, parentId);
    if (parentId) childCount.set(parentId, (childCount.get(parentId) ?? 0) + 1);
  });

  let explicitFieldCount = 0;
  const chapters: ChapterNode[] = [];
  const chapterByRawId = new Map<string, ChapterNode>();
  const resources: ResourceRecord[] = [];
  const nonChapterIds = new Set<string>();

  for (const [id, record] of rawById) {
    const sourceIndex = sourceIndexById.get(id) ?? 0;
    const explicitOrder = parseOrder(record);
    if (explicitOrder !== null) explicitFieldCount += 1;
    const title = recordTitle(record, `未命名资源 ${sourceIndex + 1}`);
    const parentId = parentById.get(id) ?? null;

    if (isChapterRecord(record, (childCount.get(id) ?? 0) > 0)) {
      const chapter: ChapterNode = {
        id,
        courseId: input.courseId,
        parentId,
        title,
        sourceIndex,
        explicitOrder,
        displayOrder: explicitOrder ?? sourceIndex,
        childChapterIds: [],
        resourceIds: [],
        depth: 0,
      };
      chapters.push(chapter);
      chapterByRawId.set(id, chapter);
    } else {
      nonChapterIds.add(id);
      const mimeType = recordMime(record);
      resources.push({
        id,
        courseId: input.courseId,
        chapterId: parentId,
        parentResourceId:
          parentId && nonChapterIds.has(parentId)
            ? parentId
            : parentId && !rawById.has(parentId)
              ? parentId
              : null,
        sourceIndex,
        explicitOrder,
        displayOrder: explicitOrder ?? sourceIndex,
        title,
        kind: inferResourceKind(mimeType, title, record),
        mimeType,
        quoteId:
          asString(record.quote_id) ??
          asString(record.quoteId) ??
          asString(record.file_id) ??
          asString(record.fileId),
        videoId: asString(record.video_id) ?? asString(record.videoId),
        url: asString(record.url) ?? asString(record.file_url) ?? null,
        sourceMetadata: {
          type: asString(record.type),
          groupId: asString(record.group_id) ?? asString(record.groupId),
          createdAt: asString(record.created_at) ?? asString(record.createdAt),
          updatedAt: asString(record.updated_at) ?? asString(record.updatedAt),
          videoId: asString(record.video_id) ?? asString(record.videoId),
        },
      });
    }
  }

  // A parent that was classified as a resource is converted into a chapter when it owns children.
  const chapterParents = new Set(chapters.map((chapter) => chapter.id));
  for (const resource of resources) {
    if (chapterParents.has(resource.id)) resource.chapterId = null;
  }

  for (const chapter of chapters) {
    const parent = chapter.parentId ? chapterByRawId.get(chapter.parentId) : undefined;
    if (parent) parent.childChapterIds.push(chapter.id);
  }

  chapters.sort(compareByOrder);
  resources.sort(compareByOrder);

  for (const resource of resources) {
    const chapter = resource.chapterId ? chapterByRawId.get(resource.chapterId) : undefined;
    if (chapter) chapter.resourceIds.push(resource.id);
  }

  const roots = chapters.filter(
    (chapter) => !chapter.parentId || !chapterByRawId.has(chapter.parentId),
  );
  const rootChapterIds = roots.map((chapter) => chapter.id);
  const orphanResourceIds = resources
    .filter((resource) => !resource.chapterId || !chapterByRawId.has(resource.chapterId))
    .map((resource) => resource.id);

  const visitOrder = new Map(roots.map((chapter) => [chapter.id, chapter.displayOrder]));
  for (const chapter of chapters) {
    const parent = chapter.parentId ? chapterByRawId.get(chapter.parentId) : undefined;
    chapter.depth = parent ? parent.depth + 1 : 0;
    chapter.childChapterIds.sort((a, b) => {
      const aNode = chapterByRawId.get(a);
      const bNode = chapterByRawId.get(b);
      return (aNode?.displayOrder ?? 0) - (bNode?.displayOrder ?? 0);
    });
    chapter.resourceIds.sort((a, b) => {
      const aRes = resources.find((resource) => resource.id === a);
      const bRes = resources.find((resource) => resource.id === b);
      return (aRes?.displayOrder ?? 0) - (bRes?.displayOrder ?? 0);
    });
  }
  void visitOrder;

  return {
    courseId: input.courseId,
    title:
      asString(input.visit?.name) ??
      asString(input.visit?.course_name) ??
      asString((input.visit as RawRecord | undefined)?.title) ??
      `课程 ${input.courseId}`,
    siteId: asString(input.visit?.site_id),
    teachers: Array.isArray(input.visit?.teachers) ? input.visit.teachers : [],
    chapters,
    resources,
    rootChapterIds,
    orphanResourceIds,
    sortEvidence: explicitFieldCount > 0 ? "explicit-order-field" : "source-order-fallback",
    appliedOrder: "platform",
    fetchedAt: input.fetchedAt ?? new Date().toISOString(),
    source: input.source ?? "fixture",
  };
}
