export type ResourceKind =
  "pdf" | "presentation" | "document" | "image" | "video" | "archive" | "exercise" | "unknown";

export interface XiaoyaTeacher {
  name?: string;
  email?: string;
}

export interface XiaoyaVisitData {
  id?: string;
  name?: string;
  site_id?: string | number;
  teachers?: XiaoyaTeacher[];
  [key: string]: unknown;
}

export interface ResourceRecord {
  id: string;
  courseId: string;
  chapterId: string | null;
  parentResourceId: string | null;
  sourceIndex: number;
  explicitOrder: number | null;
  displayOrder: number;
  title: string;
  kind: ResourceKind;
  mimeType: string | null;
  quoteId: string | null;
  url: string | null;
  sourceMetadata: Record<string, unknown>;
}

export interface ChapterNode {
  id: string;
  courseId: string;
  parentId: string | null;
  title: string;
  sourceIndex: number;
  explicitOrder: number | null;
  displayOrder: number;
  childChapterIds: string[];
  resourceIds: string[];
  depth: number;
}

export interface CourseSnapshot {
  courseId: string;
  title: string;
  siteId: string | null;
  teachers: XiaoyaTeacher[];
  chapters: ChapterNode[];
  resources: ResourceRecord[];
  rootChapterIds: string[];
  orphanResourceIds: string[];
  sortEvidence: "explicit-order-field" | "source-order-fallback";
  fetchedAt: string;
  source: "live" | "fixture";
}

export interface CourseAdapter {
  getCourseId(): string | null;
  loadCourse(courseId: string): Promise<CourseSnapshot>;
  resolveResourceUrl(resource: ResourceRecord): Promise<string>;
  fetchResourceBytes(resource: ResourceRecord): Promise<ArrayBuffer>;
}
