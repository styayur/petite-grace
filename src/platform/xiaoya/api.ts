import { mapCourseSnapshot } from "./mapping";
import type {
  AuthorizedPlayback,
  AuthorizedResource,
  CourseAdapter,
  CourseSnapshot,
  ResourceAccessIntent,
  ResourceRecord,
  XiaoyaVisitData,
} from "./types";
import { resolveAliyunVodPlayback } from "./video";
import {
  authorizedResourceFromUrl,
  decryptXiaoyaFileUrl,
  fetchAuthorizedResourceBytes,
  DEFAULT_RESOURCE_HOST_SUFFIXES,
  ResourceAccessError,
} from "./resource";

const COURSE_PATH_PATTERN = /\/app\/jx-web\/mycourse\/(\d{10,})/;
const DEFAULT_HOST_SUFFIXES = DEFAULT_RESOURCE_HOST_SUFFIXES;
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

  async resolveVideoPlayback(resource: ResourceRecord): Promise<AuthorizedPlayback> {
    const fallbackPlatformUrl = this.sameOrigin(
      `/app/jx-web/mycourse/${encodeURIComponent(resource.courseId)}?resourceId=${encodeURIComponent(resource.id)}`,
    );
    if (resource.url) {
      const authorized = authorizedResourceFromUrl({
        rawUrl: resource.url,
        intent: "preview",
        allowedHostSuffixes: this.allowedResourceHosts,
        now: this.now(),
      });
      return {
        url: authorized.url,
        kind: /\.m3u8(?:$|\?)/i.test(authorized.url) ? "hls" : "mp4",
        expiresAt: authorized.expiresAt,
        requiresPlatformAuth: resource.url.startsWith(this.location.origin),
        fallbackPlatformUrl,
      };
    }

    let videoId = resource.videoId ?? null;
    if (!videoId) {
      const resourceEnvelope = await this.requestJson(
        `/api/jx-iresource/resource/queryResource?node_id=${encodeURIComponent(resource.id)}`,
      );
      const resourceData = resourceEnvelope.data as
        { resource?: { video_id?: string | number; videoId?: string | number } } | undefined;
      const rawVideoId = resourceData?.resource?.video_id ?? resourceData?.resource?.videoId;
      videoId = rawVideoId ? String(rawVideoId) : null;
    }
    if (!videoId) {
      throw new ResourceAccessError("NO_RESOURCE_ID", "该视频没有可用的播放标识");
    }

    const authEnvelope = await this.requestJson(
      `/api/jx-oresource/vod/video/play_auth/${encodeURIComponent(videoId)}?is_public=1`,
    );
    const authData = authEnvelope.data as
      | {
          private_vod?: Array<{
            private_url?: string;
            url?: string;
            play_url?: string;
            format?: string;
          }>;
          play_auth?: string;
          play_url?: string;
          video_url?: string;
          url?: string;
        }
      | undefined;

    let rawUrl: string | null = null;
    let kind: "mp4" | "hls" = "mp4";
    const privateVod = authData?.private_vod?.find(
      (item) => item.private_url || item.url || item.play_url,
    );
    if (privateVod) {
      rawUrl = privateVod.private_url ?? privateVod.url ?? privateVod.play_url ?? null;
      if (/\.m3u8(?:$|\?)/i.test(rawUrl ?? "") || privateVod.format === "m3u8") kind = "hls";
    } else if (authData?.play_auth) {
      const resolved = await resolveAliyunVodPlayback(authData.play_auth);
      rawUrl = resolved.url;
      kind = resolved.kind;
    } else {
      rawUrl = authData?.play_url ?? authData?.video_url ?? authData?.url ?? null;
      if (/\.m3u8(?:$|\?)/i.test(rawUrl ?? "")) kind = "hls";
    }
    if (!rawUrl) {
      throw new ResourceAccessError("UNSUPPORTED_RESOURCE_URL", "平台没有返回可用视频播放地址");
    }
    const authorized = authorizedResourceFromUrl({
      rawUrl,
      intent: "preview",
      requiresPlatformAuth: rawUrl.startsWith(this.location.origin),
      allowedHostSuffixes: this.allowedResourceHosts,
      now: this.now(),
    });
    return {
      url: authorized.url,
      kind,
      expiresAt: authorized.expiresAt,
      requiresPlatformAuth: authorized.requiresPlatformAuth,
      fallbackPlatformUrl,
    };
  }
  async resolveAuthorizedResource(
    resource: ResourceRecord,
    intent: ResourceAccessIntent = "preview",
  ): Promise<AuthorizedResource> {
    if (resource.url) {
      return authorizedResourceFromUrl({
        rawUrl: resource.url,
        intent,
        previewOnly: false,
        requiresPlatformAuth: resource.url.startsWith(this.location.origin),
        source: resource.url.startsWith(this.location.origin) ? "platform-file-access" : "direct",
        allowedHostSuffixes: this.allowedResourceHosts,
        now: this.now(),
      });
    }
    if (!resource.quoteId) {
      throw new ResourceAccessError("NO_RESOURCE_ID", "该资源没有可用的文件标识");
    }

    const envelope = await this.requestJson(
      `/api/jx-oresource/cloud/file_url/${encodeURIComponent(resource.quoteId)}`,
    );
    const data = envelope.data as
      | {
          url?: string;
          is_encryption?: boolean | number | string;
          preview_only?: boolean;
          is_preview?: boolean;
          can_download?: boolean;
          download_permission?: boolean;
          expires_at?: string;
          file_access_id?: string;
        }
      | undefined;

    let rawUrl = data?.url;
    if (!rawUrl) {
      const accessId = data?.file_access_id ?? resource.quoteId;
      rawUrl = this.sameOrigin(
        `/api/jx-oresource/cloud/file_access/${encodeURIComponent(accessId)}`,
      );
    }
    if (data?.is_encryption && data.is_encryption !== "0" && data.is_encryption !== 0) {
      rawUrl = decryptXiaoyaFileUrl(rawUrl);
    }
    const previewOnly = Boolean(
      data?.preview_only ||
      data?.is_preview ||
      data?.can_download === false ||
      data?.download_permission === false,
    );
    const authorized = authorizedResourceFromUrl({
      rawUrl,
      intent,
      previewOnly,
      requiresPlatformAuth: rawUrl.startsWith(this.location.origin),
      source: rawUrl.startsWith(this.location.origin) ? "platform-file-access" : undefined,
      allowedHostSuffixes: this.allowedResourceHosts,
      now: this.now(),
    });
    if (data?.expires_at) authorized.expiresAt = data.expires_at;
    return authorized;
  }

  async resolveResourceUrl(
    resource: ResourceRecord,
    intent: ResourceAccessIntent = "download",
  ): Promise<string> {
    return (await this.resolveAuthorizedResource(resource, intent)).url;
  }

  async fetchResourceBytes(
    resource: ResourceRecord,
    options: {
      signal?: AbortSignal;
      range?: { start: number; end: number };
      maxBytes?: number;
    } = {},
  ): Promise<ArrayBuffer> {
    const authorized = await this.resolveAuthorizedResource(resource, "preview");
    return fetchAuthorizedResourceBytes(authorized, {
      fetchImpl: this.fetchImpl,
      signal: options.signal,
      range: options.range,
      maxBytes: options.maxBytes,
      allowedHostSuffixes: this.allowedResourceHosts,
      platformOrigin: this.location.origin,
      sessionToken: this.getSessionToken(),
      requiresPlatformAuth: authorized.requiresPlatformAuth,
    });
  }
}
