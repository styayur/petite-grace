import CryptoJS from "crypto-js";
import type { AuthorizedResource, AuthorizedResourceSource, ResourceAccessIntent } from "./types";

export type ResourceAccessErrorCode =
  | "NO_RESOURCE_ID"
  | "NO_RESOURCE_URL"
  | "PREVIEW_ONLY"
  | "DOWNLOAD_NOT_PERMITTED"
  | "UNTRUSTED_RESOURCE_ORIGIN"
  | "ENCRYPTED_URL_INVALID"
  | "EXPIRED_LINK"
  | "RESOURCE_HTTP_ERROR"
  | "RESOURCE_TOO_LARGE"
  | "RESOURCE_TIMEOUT"
  | "CORS_BLOCKED"
  | "UNSUPPORTED_RESOURCE_URL";

export class ResourceAccessError extends Error {
  constructor(
    public readonly code: ResourceAccessErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ResourceAccessError";
  }
}

export const DEFAULT_RESOURCE_HOST_SUFFIXES = [
  "ai-augmented.com",
  "aliyuncs.com",
  "alicdn.com",
  "myqcloud.com",
  "qcloud.com",
  "cloudfront.net",
  "amazonaws.com",
  "azureedge.net",
  "bcebos.com",
  "blob.core.windows.net",
];

const DEFAULT_MAX_BYTES = 256 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const URL_EXPIRY_PARAMS = ["Expires", "expires", "x-oss-expires", "X-OSS-Expires"];

export interface GmRequestDetails {
  method: "GET";
  url: string;
  responseType: "arraybuffer";
  headers?: Record<string, string>;
  anonymous?: boolean;
  timeout?: number;
  signal?: AbortSignal;
}

export interface GmRequestResult {
  status: number;
  response: ArrayBuffer;
  finalUrl?: string;
  responseHeaders?: string;
}

export type GmRequest = (details: GmRequestDetails) => Promise<GmRequestResult>;

export interface SafeResourceFetchOptions {
  fetchImpl?: typeof fetch;
  gmRequest?: GmRequest | null;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxBytes?: number;
  range?: { start: number; end: number };
  allowedHostSuffixes?: string[];
  platformOrigin?: string;
  sessionToken?: string | null;
  requiresPlatformAuth?: boolean;
}

function isPrivateOrLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

export function isTrustedResourceUrl(
  rawUrl: string,
  allowedHostSuffixes: string[] = DEFAULT_RESOURCE_HOST_SUFFIXES,
): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    if (isPrivateOrLocalHost(url.hostname)) return false;
    return allowedHostSuffixes.some(
      (suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

export function isSignedResourceUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return [
      "Signature",
      "signature",
      "OSSAccessKeyId",
      "X-Amz-Algorithm",
      "X-Amz-Signature",
      "sign",
      "token",
    ].some((parameter) => url.searchParams.has(parameter));
  } catch {
    return false;
  }
}

function parseExpiry(url: URL): string | null {
  for (const parameter of URL_EXPIRY_PARAMS) {
    const value = url.searchParams.get(parameter);
    if (!value) continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      const milliseconds = numeric > 10_000_000_000 ? numeric : numeric * 1000;
      return new Date(milliseconds).toISOString();
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  const amzDate = url.searchParams.get("X-Amz-Date");
  const amzExpires = Number(url.searchParams.get("X-Amz-Expires"));
  if (amzDate && Number.isFinite(amzExpires)) {
    const base = Date.parse(
      `${amzDate.slice(0, 4)}-${amzDate.slice(4, 6)}-${amzDate.slice(6, 8)}T${amzDate.slice(9, 11)}:${amzDate.slice(11, 13)}:${amzDate.slice(13, 15)}Z`,
    );
    if (Number.isFinite(base)) return new Date(base + amzExpires * 1000).toISOString();
  }
  return null;
}

export function validateResourceDestination(
  rawUrl: string,
  allowedHostSuffixes: string[] = DEFAULT_RESOURCE_HOST_SUFFIXES,
  now: Date = new Date(),
): { url: string; expiresAt: string | null; signed: boolean } {
  if (!isTrustedResourceUrl(rawUrl, allowedHostSuffixes)) {
    throw new ResourceAccessError("UNTRUSTED_RESOURCE_ORIGIN", "资源地址未通过来源校验");
  }
  const url = new URL(rawUrl);
  const expiresAt = parseExpiry(url);
  if (expiresAt && new Date(expiresAt).getTime() <= now.getTime()) {
    throw new ResourceAccessError("EXPIRED_LINK", "资源授权链接已过期，请刷新后重试");
  }
  return { url: url.toString(), expiresAt, signed: isSignedResourceUrl(url.toString()) };
}

export function decryptXiaoyaFileUrl(encryptedUrl: string): string {
  try {
    const key = CryptoJS.enc.Utf8.parse("94374647");
    const iv = CryptoJS.enc.Utf8.parse("99526255");
    const normalized = encryptedUrl.replace(/_/g, "+").replace(/\*/g, "/").replace(/-/g, "=");
    const ciphertext = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Base64.parse(normalized),
    });
    const decrypted = CryptoJS.DES.decrypt(ciphertext, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    }).toString(CryptoJS.enc.Utf8);
    if (!decrypted) throw new Error("empty decrypted value");
    return decrypted;
  } catch {
    throw new ResourceAccessError("ENCRYPTED_URL_INVALID", "平台加密资源地址无法解析");
  }
}

export function authorizedResourceFromUrl(input: {
  rawUrl: string;
  intent: ResourceAccessIntent;
  previewOnly?: boolean;
  requiresPlatformAuth?: boolean;
  source?: AuthorizedResourceSource;
  allowedHostSuffixes?: string[];
  now?: Date;
}): AuthorizedResource {
  if (input.intent === "download" && input.previewOnly) {
    throw new ResourceAccessError("DOWNLOAD_NOT_PERMITTED", "该资源仅允许预览，不提供下载权限");
  }
  const validated = validateResourceDestination(
    input.rawUrl,
    input.allowedHostSuffixes ?? DEFAULT_RESOURCE_HOST_SUFFIXES,
    input.now,
  );
  const source = input.source ?? (validated.signed ? "signed-cdn" : "direct");
  return {
    url: validated.url,
    intent: input.intent,
    source,
    previewOnly: Boolean(input.previewOnly),
    requiresPlatformAuth: Boolean(input.requiresPlatformAuth),
    expiresAt: validated.expiresAt,
    canRange: true,
  };
}

function resolveGmRequest(): GmRequest | null {
  const runtime = globalThis as typeof globalThis & {
    GM_xmlhttpRequest?: (details: Record<string, unknown>) => unknown;
  };
  if (typeof runtime.GM_xmlhttpRequest !== "function") return null;
  return (details) =>
    new Promise<GmRequestResult>((resolve, reject) => {
      const request = runtime.GM_xmlhttpRequest!({
        method: details.method,
        url: details.url,
        responseType: details.responseType,
        headers: details.headers,
        anonymous: details.anonymous,
        timeout: details.timeout,
        onload: (response: {
          status: number;
          response: ArrayBuffer;
          finalUrl?: string;
          responseHeaders?: string;
        }) =>
          resolve({
            status: response.status,
            response: response.response,
            finalUrl: response.finalUrl,
            responseHeaders: response.responseHeaders,
          }),
        onerror: () => reject(new ResourceAccessError("CORS_BLOCKED", "资源请求失败")),
        ontimeout: () => reject(new ResourceAccessError("RESOURCE_TIMEOUT", "资源请求超时")),
        onabort: () => reject(new DOMException("Aborted", "AbortError")),
      });
      if (details.signal) {
        details.signal.addEventListener("abort", () => {
          const aborter = (request as { abort?: () => void }).abort;
          aborter?.();
        });
      }
    });
}

function statusError(status: number): ResourceAccessError {
  if (status === 401 || status === 403 || status === 410) {
    return new ResourceAccessError("EXPIRED_LINK", "资源授权已失效，请刷新后重试", status);
  }
  if (status === 404) {
    return new ResourceAccessError("RESOURCE_HTTP_ERROR", "资源不存在或已被移除", status);
  }
  return new ResourceAccessError("RESOURCE_HTTP_ERROR", `资源请求失败（HTTP ${status}）`, status);
}

function responseHeader(result: GmRequestResult, name: string): string | null {
  if (!result.responseHeaders) return null;
  for (const line of result.responseHeaders.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    if (line.slice(0, separator).trim().toLowerCase() === name.toLowerCase()) {
      return line.slice(separator + 1).trim();
    }
  }
  return null;
}

export async function fetchAuthorizedResourceBytes(
  authorized: AuthorizedResource,
  options: SafeResourceFetchOptions = {},
): Promise<ArrayBuffer> {
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  const gmRequest = options.gmRequest === undefined ? resolveGmRequest() : options.gmRequest;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const headers: Record<string, string> = {};
  if (options.range) headers.Range = `bytes=${options.range.start}-${options.range.end}`;
  if (authorized.requiresPlatformAuth && options.sessionToken) {
    headers.Authorization = `Bearer ${options.sessionToken}`;
  }
  const signal = options.signal ?? AbortSignal.timeout(options.timeoutMs ?? 120_000);

  let currentUrl = authorized.url;
  let response: Response | null = null;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    try {
      response = await fetchImpl(currentUrl, {
        method: "GET",
        headers,
        credentials:
          authorized.requiresPlatformAuth && currentUrl.startsWith(options.platformOrigin ?? "\0")
            ? "include"
            : "omit",
        redirect: "follow",
        signal,
      });
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") throw reason;
      if (authorized.requiresPlatformAuth) {
        throw new ResourceAccessError("CORS_BLOCKED", "平台文件访问请求失败");
      }
      if (gmRequest) {
        try {
          const gmResult = await gmRequest({
            method: "GET",
            url: currentUrl,
            responseType: "arraybuffer",
            headers: Object.keys(headers).length ? headers : undefined,
            anonymous: true,
            timeout: options.timeoutMs ?? 120_000,
            signal,
          });
          if (gmResult.status < 200 || gmResult.status >= 300) throw statusError(gmResult.status);
          const finalUrl = gmResult.finalUrl ?? currentUrl;
          validateResourceDestination(finalUrl, options.allowedHostSuffixes);
          if (gmResult.response.byteLength > maxBytes) {
            throw new ResourceAccessError("RESOURCE_TOO_LARGE", "资源文件过大");
          }
          return gmResult.response;
        } catch (gmReason) {
          if (gmReason instanceof ResourceAccessError) throw gmReason;
          throw new ResourceAccessError("CORS_BLOCKED", "受权资源被浏览器 CORS 阻止");
        }
      }
      throw new ResourceAccessError("CORS_BLOCKED", "受权资源被浏览器 CORS 阻止");
    }

    if (response.url) {
      try {
        validateResourceDestination(response.url, options.allowedHostSuffixes);
      } catch (reason) {
        if (reason instanceof ResourceAccessError) throw reason;
      }
      currentUrl = response.url;
    }
    break;
  }

  if (!response) throw new ResourceAccessError("CORS_BLOCKED", "资源请求未返回响应");
  if (!response.ok) throw statusError(response.status);
  const length = Number(response.headers.get("content-length") ?? "0");
  if (length > maxBytes) throw new ResourceAccessError("RESOURCE_TOO_LARGE", "资源文件过大");
  if (response.body) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      loaded += value.byteLength;
      if (loaded > maxBytes) {
        await reader.cancel();
        throw new ResourceAccessError("RESOURCE_TOO_LARGE", "资源文件过大");
      }
      chunks.push(value);
    }
    const output = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return output.buffer;
  }
  return response.arrayBuffer();
}
