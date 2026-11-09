import { mapCourseSnapshot } from "./mapping";
import type { CourseAdapter, CourseSnapshot, ResourceRecord, XiaoyaVisitData } from "./types";

const COURSE_PATH_PATTERN = /\/app\/jx-web\/mycourse\/(\d{10,})/;
const DEFAULT_HOST_SUFFIXES = ["ai-augmented.com"];
const MAX_JSON_BYTES = 8 * 1024 * 1024;

export class XiaoyaApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "XiaoyaApiError";
  }
}

export function getCourseIdFromLocation(location: Pick<Location, "pathname">): string | null {
  return COURSE_PATH_PATTERN.exec(location.pathname)?.[1] ?? null;
}

export function readSessionToken(cookieSource: string): string | null {
  for (const part of cookieSource.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name?.includes("prd-access-token")) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function isAllowedResourceUrl(
  rawUrl: string,
  allowedSuffixes = DEFAULT_HOST_SUFFIXES,
): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    return allowedSuffixes.some(
      (suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

function responseIsJson(response: Response): boolean {
  return (response.headers.get("content-type") ?? "").toLowerCase().includes("json");
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const length = Number(response.headers.get("content-length") ?? "0");
  if (length > MAX_JSON_BYTES) throw new XiaoyaApiError("RESPONSE_TOO_LARGE", "平台响应过大");
  const text = await response.text();
  if (text.length > MAX_JSON_BYTES) throw new XiaoyaApiError("RESPONSE_TOO_LARGE", "平台响应过大");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new XiaoyaApiError("INVALID_JSON", "平台返回了无法解析的数据");
  }
}

interface ApiEnvelope {
  success?: boolean;
  code?: number | string;
  message?: string;
  data?: unknown;
}

function asEnvelope(value: unknown): ApiEnvelope {
  return value && typeof value === "object" ? (value as ApiEnvelope) : {};
}

export interface XiaoyaApiClientOptions {
  fetchImpl?: typeof fetch;
  location?: Pick<Location, "origin" | "hostname" | "pathname">;
  cookieSource?: () => string;
  now?: () => Date;
  allowedResourceHosts?: string[];
}

export class XiaoyaApiClient implements CourseAdapter {
  private readonly fetchImpl: typeof fetch;
  private readonly location: Pick<Location, "origin" | "hostname" | "pathname">;
  private readonly cookieSource: () => string;
  private readonly now: () => Date;
  private readonly allowedResourceHosts: string[];
  private courseSiteId: string | null = null;

  constructor(options: XiaoyaApiClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    this.location = options.location ?? window.location;
    this.cookieSource = options.cookieSource ?? (() => document.cookie);
    this.now = options.now ?? (() => new Date());
    this.allowedResourceHosts = options.allowedResourceHosts ?? DEFAULT_HOST_SUFFIXES;
  }

  getCourseId(): string | null {
    return getCourseIdFromLocation(this.location);
  }

  private getSessionToken(): string | null {
    return readSessionToken(this.cookieSource());
  }

  private sameOrigin(path: string): string {
    return new URL(path, this.location.origin).toString();
  }

  private async requestJson(path: string, init: RequestInit = {}): Promise<ApiEnvelope> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    const token = this.getSessionToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await this.fetchImpl(this.sameOrigin(path), {
      ...init,
      headers,
      credentials: "include",
      signal: init.signal ?? AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new XiaoyaApiError(
        "HTTP_ERROR",
        `平台请求失败（HTTP ${response.status}）`,
        response.status,
      );
    }
    if (!responseIsJson(response)) {
      throw new XiaoyaApiError("INVALID_CONTENT_TYPE", "平台没有返回 JSON 数据", response.status);
    }
    return asEnvelope(await readBoundedJson(response));
  }

  async loadCourse(courseId: string): Promise<CourseSnapshot> {
    const visitEnvelope = await this.requestJson("/api/jx-iresource/statistics/group/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ group_id: courseId, role_type: "normal" }),
    });
    if (!visitEnvelope.success) {
      throw new XiaoyaApiError("VISIT_FAILED", visitEnvelope.message ?? "无法读取课程信息");
    }
    const visit = visitEnvelope.data as XiaoyaVisitData;
    this.courseSiteId = visit?.site_id ? String(visit.site_id) : null;

    let resourceEnvelope = await this.requestJson(
      `/api/jx-iresource/resource/queryCourseResources?group_id=${encodeURIComponent(courseId)}`,
    );
    if (String(resourceEnvelope.code) === "50007" && this.courseSiteId) {
      const access = await this.requestJson(
        `/api/jx-iresource/group/access/authorization?site_id=${encodeURIComponent(this.courseSiteId)}&role_type=4`,
      );
      const accessToken = asEnvelope(access).data as { access_group_token?: string } | undefined;
      if (accessToken?.access_group_token) {
        resourceEnvelope = await this.requestJson(
          `/api/jx-iresource/resource/queryCourseResources?group_id=${encodeURIComponent(courseId)}`,
          { headers: { "X-Course-Access": accessToken.access_group_token } },
        );
      }
    }
    if (!resourceEnvelope.success) {
      throw new XiaoyaApiError("RESOURCES_FAILED", resourceEnvelope.message ?? "无法读取课程资源");
    }

    return mapCourseSnapshot({
      courseId,
      visit,
      resources: resourceEnvelope.data,
      fetchedAt: this.now().toISOString(),
      source: "live",
    });
  }

  async resolveResourceUrl(resource: ResourceRecord): Promise<string> {
    if (resource.url && isAllowedResourceUrl(resource.url, this.allowedResourceHosts)) {
      return resource.url;
    }
    if (!resource.quoteId) {
      throw new XiaoyaApiError("NO_DOWNLOAD_ID", "该资源没有可用的下载标识");
    }
    const envelope = await this.requestJson(
      `/api/jx-oresource/cloud/file_url/${encodeURIComponent(resource.quoteId)}`,
    );
    const data = envelope.data as
      { url?: string; is_encryption?: boolean | number | string } | undefined;
    if (!data?.url) {
      throw new XiaoyaApiError("NO_DOWNLOAD_URL", "平台没有返回下载地址");
    }
    if (data.is_encryption && data.is_encryption !== "0" && data.is_encryption !== 0) {
      throw new XiaoyaApiError(
        "ENCRYPTED_DOWNLOAD_URL",
        "平台返回了加密下载地址；为避免把登录凭证发给外域，请使用平台原始下载入口",
      );
    }
    if (!isAllowedResourceUrl(data.url, this.allowedResourceHosts)) {
      throw new XiaoyaApiError("UNTRUSTED_DOWNLOAD_URL", "下载地址未通过来源校验");
    }
    return data.url;
  }

  async fetchResourceBytes(resource: ResourceRecord): Promise<ArrayBuffer> {
    const url = await this.resolveResourceUrl(resource);
    const response = await this.fetchImpl(url, {
      method: "GET",
      credentials: "omit",
      redirect: "follow",
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      throw new XiaoyaApiError("DOWNLOAD_HTTP_ERROR", `文件读取失败（HTTP ${response.status}）`);
    }
    return response.arrayBuffer();
  }
}
