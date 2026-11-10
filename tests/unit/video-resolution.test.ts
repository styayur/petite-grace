import { describe, expect, it, vi } from "vitest";
import { XiaoyaApiClient } from "../../src/platform/xiaoya/api";
import { resolveAliyunVodPlayback } from "../../src/platform/xiaoya/video";
import type { ResourceRecord } from "../../src/platform/xiaoya/types";

const videoResource: ResourceRecord = {
  id: "video-node",
  courseId: "course-1",
  chapterId: null,
  parentResourceId: null,
  sourceIndex: 0,
  explicitOrder: null,
  displayOrder: 0,
  title: "课程视频.mp4",
  kind: "video",
  mimeType: "video/mp4",
  quoteId: null,
  videoId: "video-123",
  url: null,
  sourceMetadata: {},
};

const location = {
  origin: "https://course.ai-augmented.com",
  hostname: "course.ai-augmented.com",
  pathname: "/app/jx-web/mycourse/1234567890123456789",
};

function client(fetchImpl: typeof fetch): XiaoyaApiClient {
  return new XiaoyaApiClient({
    fetchImpl,
    location,
    cookieSource: () => "prd-access-token=secret-token",
  });
}

describe("video playback resolution", () => {
  it("returns a validated HLS private_vod URL", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              private_vod: [
                {
                  private_url:
                    "https://vod.cn-shanghai.aliyuncs.com/path/video.m3u8?Signature=abc&Expires=9999999999",
                  format: "m3u8",
                },
              ],
            },
          }),
          { headers: { "content-type": "application/json" } },
        ),
    ) as typeof fetch;
    const playback = await client(fetchImpl).resolveVideoPlayback(videoResource);
    expect(playback.kind).toBe("hls");
    expect(playback.url).toContain("video.m3u8");
    expect(playback.fallbackPlatformUrl).toContain("resourceId=video-node");
  });

  it("rejects an untrusted video playback origin", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: { private_vod: [{ private_url: "https://evil.example/video.m3u8" }] },
          }),
          { headers: { "content-type": "application/json" } },
        ),
    ) as typeof fetch;
    await expect(client(fetchImpl).resolveVideoPlayback(videoResource)).rejects.toMatchObject({
      code: "UNTRUSTED_RESOURCE_ORIGIN",
    });
  });

  it("resolves Aliyun play_auth into a playable MP4/HLS URL", async () => {
    const playAuth = btoa(
      JSON.stringify({
        VideoMeta: { VideoId: "video-123" },
        AccessKeyId: "access",
        AccessKeySecret: "secret",
        SecurityToken: "token",
        Region: "cn-shanghai",
        AuthInfo: "auth-info",
      }),
    );
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            PlayInfoList: {
              PlayInfo: [
                {
                  Format: "m3u8",
                  Width: 1280,
                  PlayURL:
                    "https://vod.cn-shanghai.aliyuncs.com/video.m3u8?Signature=abc&Expires=9999999999",
                },
              ],
            },
          }),
          { headers: { "content-type": "application/json" } },
        ),
    ) as typeof fetch;
    const playback = await resolveAliyunVodPlayback(playAuth, {
      fetchImpl,
      gmTextRequest: null,
      nonce: () => "fixed-nonce",
    });
    expect(playback.kind).toBe("hls");
    expect(playback.url).toContain("video.m3u8");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
