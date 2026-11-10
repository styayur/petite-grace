import CryptoJS from "crypto-js";
import { describe, expect, it, vi } from "vitest";
import { XiaoyaApiClient } from "../../src/platform/xiaoya/api";
import {
  authorizedResourceFromUrl,
  decryptXiaoyaFileUrl,
  fetchAuthorizedResourceBytes,
  ResourceAccessError,
} from "../../src/platform/xiaoya/resource";
import type { ResourceRecord } from "../../src/platform/xiaoya/types";

const resource: ResourceRecord = {
  id: "resource-1",
  courseId: "course-1",
  chapterId: null,
  parentResourceId: null,
  sourceIndex: 0,
  explicitOrder: null,
  displayOrder: 0,
  title: "讲义.pdf",
  kind: "pdf",
  mimeType: "application/pdf",
  quoteId: "quote-1",
  url: null,
  sourceMetadata: {},
};

function encryptUrl(rawUrl: string): string {
  const key = CryptoJS.enc.Utf8.parse("94374647");
  const iv = CryptoJS.enc.Utf8.parse("99526255");
  const encrypted = CryptoJS.DES.encrypt(rawUrl, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).toString();
  return encrypted.replace(/\+/g, "_").replace(/\//g, "*").replace(/=/g, "-");
}

function platformClient(fetchImpl: typeof fetch): XiaoyaApiClient {
  return new XiaoyaApiClient({
    fetchImpl,
    location: {
      origin: "https://course.ai-augmented.com",
      hostname: "course.ai-augmented.com",
      pathname: "/app/jx-web/mycourse/1234567890123456789",
    },
    cookieSource: () => "prd-access-token=secret-token",
  });
}

describe("authorized resource resolution", () => {
  it("accepts a valid signed CDN URL and rejects arbitrary origins", () => {
    const signed = authorizedResourceFromUrl({
      rawUrl: "https://oss.ai-augmented.com/files/lecture.pdf?Signature=abc&Expires=9999999999",
      intent: "preview",
    });
    expect(signed.source).toBe("signed-cdn");
    expect(signed.expiresAt).toBeTruthy();
    expect(() =>
      authorizedResourceFromUrl({
        rawUrl: "https://evil.example/files/lecture.pdf",
        intent: "preview",
      }),
    ).toThrow(ResourceAccessError);
  });

  it("rejects an expired signed URL before making a resource request", () => {
    expect(() =>
      authorizedResourceFromUrl({
        rawUrl: "https://oss.ai-augmented.com/files/lecture.pdf?Signature=abc&Expires=1",
        intent: "preview",
      }),
    ).toThrow(expect.objectContaining({ code: "EXPIRED_LINK" }));
  });

  it("decrypts the platform encrypted URL form", () => {
    const raw = "https://oss.ai-augmented.com/files/lecture.pdf?Signature=abc&Expires=9999999999";
    expect(decryptXiaoyaFileUrl(encryptUrl(raw))).toBe(raw);
  });

  it("resolves encrypted platform responses and never sends the token to the CDN", async () => {
    const raw = "https://oss.ai-augmented.com/files/lecture.pdf?Signature=abc&Expires=9999999999";
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (String(url).includes("/cloud/file_url/")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { url: encryptUrl(raw), is_encryption: true },
          }),
          { headers: { "content-type": "application/json" } },
        );
      }
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "application/pdf", "content-length": "3" },
      });
    }) as typeof fetch;
    const client = platformClient(fetchImpl);
    const authorized = await client.resolveAuthorizedResource(resource, "preview");
    expect(authorized.url).toBe(raw);
    await client.fetchResourceBytes(resource);
    const cdnCall = calls.find((call) => call.url.startsWith("https://oss.ai-augmented.com"));
    expect(new Headers(cdnCall?.init?.headers).get("Authorization")).toBeNull();
    expect(cdnCall?.init?.credentials).toBe("omit");
  });

  it("distinguishes preview-only access from download permission", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              url: "https://oss.ai-augmented.com/files/lecture.pdf?Signature=abc&Expires=9999999999",
              preview_only: true,
            },
          }),
          { headers: { "content-type": "application/json" } },
        ),
    ) as typeof fetch;
    const client = platformClient(fetchImpl);
    const preview = await client.resolveAuthorizedResource(resource, "preview");
    expect(preview.previewOnly).toBe(true);
    await expect(client.resolveAuthorizedResource(resource, "download")).rejects.toMatchObject({
      code: "DOWNLOAD_NOT_PERMITTED",
    });
  });

  it("falls back to the userscript request adapter for CORS-blocked signed URLs", async () => {
    const gmRequest = vi.fn(async () => ({
      status: 200,
      response: new Uint8Array([9, 8, 7]).buffer,
      finalUrl: "https://oss.ai-augmented.com/files/lecture.pdf?Signature=abc",
      responseHeaders: "content-type: application/pdf\ncontent-length: 3",
    }));
    const bytes = await fetchAuthorizedResourceBytes(
      {
        url: "https://oss.ai-augmented.com/files/lecture.pdf?Signature=abc",
        intent: "preview",
        source: "signed-cdn",
        previewOnly: false,
        requiresPlatformAuth: false,
        expiresAt: null,
        canRange: true,
      },
      {
        fetchImpl: (async () => {
          throw new TypeError("CORS blocked");
        }) as typeof fetch,
        gmRequest,
      },
    );
    expect(Array.from(new Uint8Array(bytes))).toEqual([9, 8, 7]);
    expect(gmRequest).toHaveBeenCalledWith(
      expect.objectContaining({ anonymous: true, responseType: "arraybuffer" }),
    );
  });
});
