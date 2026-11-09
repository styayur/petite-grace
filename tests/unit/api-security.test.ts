import { describe, expect, it } from "vitest";
import {
  getCourseIdFromLocation,
  isAllowedResourceUrl,
  readSessionToken,
  XiaoyaApiClient,
} from "../../src/platform/xiaoya/api";

describe("Xiaoya URL and credential boundaries", () => {
  it("extracts a course id from the course path", () => {
    expect(
      getCourseIdFromLocation({ pathname: "/app/jx-web/mycourse/1234567890123456789/home" }),
    ).toBe("1234567890123456789");
    expect(getCourseIdFromLocation({ pathname: "/app/jx-web/home" })).toBeNull();
  });

  it("reads the session token without exposing it in a return object", () => {
    expect(readSessionToken("foo=1; prd-access-token=secret-token; bar=2")).toBe("secret-token");
    expect(readSessionToken("foo=1")).toBeNull();
  });

  it("accepts only HTTPS ai-augmented hosts", () => {
    expect(isAllowedResourceUrl("https://oss.ai-augmented.com/file.pdf")).toBe(true);
    expect(isAllowedResourceUrl("http://oss.ai-augmented.com/file.pdf")).toBe(false);
    expect(isAllowedResourceUrl("https://evil.example/file.pdf")).toBe(false);
    expect(isAllowedResourceUrl("https://ai-augmented.com.evil.example/file.pdf")).toBe(false);
  });

  it("does not send the platform Bearer token to a foreign download URL", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (String(url).includes("/cloud/file_url/")) {
        return new Response(
          JSON.stringify({ success: true, data: { url: "https://evil.example/file.pdf" } }),
          { headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ success: true, data: { name: "Course" } }), {
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const client = new XiaoyaApiClient({
      fetchImpl,
      location: {
        origin: "https://course.ai-augmented.com",
        hostname: "course.ai-augmented.com",
        pathname: "/app/jx-web/mycourse/1234567890123456789",
      },
      cookieSource: () => "prd-access-token=secret-token",
    });

    await expect(
      client.resolveResourceUrl({
        id: "r1",
        courseId: "c1",
        chapterId: null,
        parentResourceId: null,
        sourceIndex: 0,
        explicitOrder: null,
        displayOrder: 0,
        title: "file.pdf",
        kind: "pdf",
        mimeType: "application/pdf",
        quoteId: "q1",
        url: null,
        sourceMetadata: {},
      }),
    ).rejects.toMatchObject({ code: "UNTRUSTED_DOWNLOAD_URL" });

    const platformCall = calls.find((call) => call.url.includes("/cloud/file_url/"));
    expect(platformCall?.url.startsWith("https://course.ai-augmented.com/")).toBe(true);
    expect(new Headers(platformCall?.init?.headers).get("Authorization")).toBe(
      "Bearer secret-token",
    );
    expect(calls.some((call) => call.url.includes("evil.example"))).toBe(false);
  });
});
