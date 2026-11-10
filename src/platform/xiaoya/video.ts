import { ResourceAccessError } from "./resource";

interface AliyunPlayAuth {
  VideoMeta?: { VideoId?: string };
  AccessKeyId?: string;
  AccessKeySecret?: string;
  SecurityToken?: string;
  Region?: string;
  AuthInfo?: string;
}

interface AliyunPlayInfo {
  Format?: string;
  PlayURL?: string;
  Width?: number;
}

export interface ResolvedVideoSource {
  url: string;
  kind: "mp4" | "hls";
}

export interface GmTextRequestDetails {
  method: "GET";
  url: string;
  responseType: "text";
  anonymous?: boolean;
  timeout?: number;
}

export interface GmTextRequestResult {
  status: number;
  responseText: string;
  finalUrl?: string;
}

export type GmTextRequest = (details: GmTextRequestDetails) => Promise<GmTextRequestResult>;

function defaultGmTextRequest(): GmTextRequest | null {
  const runtime = globalThis as typeof globalThis & {
    GM_xmlhttpRequest?: (details: Record<string, unknown>) => unknown;
  };
  if (typeof runtime.GM_xmlhttpRequest !== "function") return null;
  return (details) =>
    new Promise<GmTextRequestResult>((resolve, reject) => {
      runtime.GM_xmlhttpRequest!({
        method: details.method,
        url: details.url,
        responseType: details.responseType,
        anonymous: details.anonymous,
        timeout: details.timeout,
        onload: (response: { status: number; responseText: string; finalUrl?: string }) =>
          resolve({
            status: response.status,
            responseText: response.responseText,
            finalUrl: response.finalUrl,
          }),
        onerror: () => reject(new ResourceAccessError("CORS_BLOCKED", "视频授权请求失败")),
        ontimeout: () => reject(new ResourceAccessError("RESOURCE_TIMEOUT", "视频授权请求超时")),
      });
    });
}

function decodeBase64Json<T>(value: string): T {
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    throw new ResourceAccessError("UNSUPPORTED_RESOURCE_URL", "视频播放凭证格式无法识别");
  }
}

function aliyunEncode(value: string): string {
  return encodeURIComponent(value).replace(/\+/g, "%20").replace(/\*/g, "%2A").replace(/%7E/g, "~");
}

function sortedQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((key) => params[key])
    .sort()
    .map((key) => `${aliyunEncode(key)}=${aliyunEncode(params[key]!)}`)
    .join("&");
}

function toBase64(bytes: ArrayBuffer): string {
  const binary = Array.from(new Uint8Array(bytes), (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary);
}

async function signAliyunRequest(
  params: Record<string, string>,
  accessSecret: string,
): Promise<string> {
  const stringToSign = `GET&%2F&${aliyunEncode(sortedQuery(params))}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${accessSecret}&`),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  return toBase64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(stringToSign)));
}

async function fetchAliyunPlayInfoJson(
  url: string,
  fetchImpl: typeof fetch,
  gmTextRequest: GmTextRequest | null,
): Promise<unknown> {
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      credentials: "omit",
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new ResourceAccessError(
        response.status === 401 || response.status === 403 ? "EXPIRED_LINK" : "RESOURCE_HTTP_ERROR",
        "视频播放信息请求失败",
        response.status,
      );
    }
    return JSON.parse(await response.text()) as unknown;
  } catch (reason) {
    if (reason instanceof ResourceAccessError) throw reason;
    if (!gmTextRequest) {
      throw new ResourceAccessError("CORS_BLOCKED", "视频播放信息被浏览器 CORS 阻止");
    }
    const result = await gmTextRequest({
      method: "GET",
      url,
      responseType: "text",
      anonymous: true,
      timeout: 30_000,
    });
    if (result.status < 200 || result.status >= 300) {
      throw new ResourceAccessError("RESOURCE_HTTP_ERROR", "视频播放信息请求失败", result.status);
    }
    try {
      return JSON.parse(result.responseText) as unknown;
    } catch {
      throw new ResourceAccessError("UNSUPPORTED_RESOURCE_URL", "视频播放信息格式无法识别");
    }
  }
}

export async function resolveAliyunVodPlayback(
  encodedPlayAuth: string,
  options: {
    fetchImpl?: typeof fetch;
    gmTextRequest?: GmTextRequest | null;
    nonce?: () => string;
  } = {},
): Promise<ResolvedVideoSource> {
  const playAuth = decodeBase64Json<AliyunPlayAuth>(encodedPlayAuth);
  const region = playAuth.Region || "cn-shanghai";
  const videoId = playAuth.VideoMeta?.VideoId;
  if (!playAuth.AccessKeyId || !playAuth.AccessKeySecret || !playAuth.SecurityToken || !videoId) {
    throw new ResourceAccessError("UNSUPPORTED_RESOURCE_URL", "视频播放凭证缺少必要字段");
  }
  const params: Record<string, string> = {
    AccessKeyId: playAuth.AccessKeyId,
    Action: "GetPlayInfo",
    VideoId: videoId,
    Formats: "m3u8,mp4",
    SecurityToken: playAuth.SecurityToken,
    StreamType: "video",
    Format: "JSON",
    Version: "2017-03-21",
    SignatureMethod: "HMAC-SHA1",
    SignatureVersion: "1.0",
    SignatureNonce: options.nonce?.() ?? crypto.randomUUID(),
  };
  if (playAuth.AuthInfo) params.AuthInfo = playAuth.AuthInfo;
  const signature = await signAliyunRequest(params, playAuth.AccessKeySecret);
  const query = `${sortedQuery(params)}&Signature=${aliyunEncode(signature)}`;
  const endpoint = `https://vod.${region}.aliyuncs.com/?${query}`;
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  const gmTextRequest =
    options.gmTextRequest === undefined ? defaultGmTextRequest() : options.gmTextRequest;
  const data = (await fetchAliyunPlayInfoJson(endpoint, fetchImpl, gmTextRequest)) as {
    PlayInfoList?: { PlayInfo?: AliyunPlayInfo[] };
    Code?: string;
    Message?: string;
  };
  const playInfos = data.PlayInfoList?.PlayInfo ?? [];
  const hls = playInfos
    .filter((item) => item.Format?.toLowerCase().includes("m3u8") && item.PlayURL)
    .sort((a, b) => (b.Width ?? 0) - (a.Width ?? 0))[0];
  const mp4 = playInfos
    .filter((item) => item.Format?.toLowerCase() === "mp4" && item.PlayURL)
    .sort((a, b) => (b.Width ?? 0) - (a.Width ?? 0))[0];
  const selected = hls ?? mp4;
  if (!selected?.PlayURL) {
    throw new ResourceAccessError(
      "UNSUPPORTED_RESOURCE_URL",
      data.Code ? `视频服务返回 ${data.Code}` : "没有可用的视频播放地址",
    );
  }
  return {
    url: selected.PlayURL,
    kind: selected === hls ? "hls" : "mp4",
  };
}
