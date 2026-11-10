export type ResourceAccessIntent = "preview" | "file" | "download";
export type AuthorizedResourceSource = "direct" | "signed-cdn" | "platform-file-access";

export interface AuthorizedPlayback {
  url: string;
  kind: "mp4" | "hls";
  expiresAt: string | null;
  requiresPlatformAuth: boolean;
  fallbackPlatformUrl: string;
}

export interface AuthorizedResource {
  url: string;
  intent: ResourceAccessIntent;
  source: AuthorizedResourceSource;
  previewOnly: boolean;
  requiresPlatformAuth: boolean;
  expiresAt: string | null;
  canRange: boolean;
}

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
  videoId?: string | null;
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
  appliedOrder?: "platform" | "chapter-number" | "local";
  fetchedAt: string;
  source: "live" | "fixture";
}

export interface CourseAdapter {
  getCourseId(): string | null;
  loadCourse(courseId: string): Promise<CourseSnapshot>;
  resolveResourceUrl(resource: ResourceRecord, intent?: ResourceAccessIntent): Promise<string>;
  resolveVideoPlayback?(resource: ResourceRecord): Promise<AuthorizedPlayback>;
  resolveAuthorizedResource?(
    resource: ResourceRecord,
    intent?: ResourceAccessIntent,
  ): Promise<AuthorizedResource>;
  fetchResourceBytes(
    resource: ResourceRecord,
    options?: {
      signal?: AbortSignal;
      range?: { start: number; end: number };
      maxBytes?: number;
    },
  ): Promise<ArrayBuffer>;
}
