import { expect, test } from "@playwright/test";

test("opens a video resource in the in-app player", async ({ page }) => {
  await page.goto("/tests/harness/");
  await page.getByLabel("资源范围").selectOption("all");
  await page.getByText("课程视频：阅读方法示例.mp4").click();
  await expect(page.locator(".pg-video-reader")).toBeVisible();
  await expect(page.getByLabel("课程视频：阅读方法示例.mp4", { exact: true })).toBeVisible();
  await page.getByLabel("播放速度", { exact: true }).selectOption("1.5");
  await expect
    .poll(async () =>
      page
        .getByLabel("课程视频：阅读方法示例.mp4", { exact: true })
        .evaluate((element) => (element as HTMLVideoElement).playbackRate),
    )
    .toBe(1.5);
  await expect(page.getByRole("link", { name: "平台播放" })).toBeVisible();
});
