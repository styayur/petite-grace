import { expect, test } from "@playwright/test";

test.skip(
  !process.env.CAPTURE_SCREENSHOTS,
  "Set CAPTURE_SCREENSHOTS=1 to refresh documentation screenshots",
);

test("captures real workspace screenshots", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/tests/harness/");
  await expect(page.locator(".pg-pdf-page").first()).toBeVisible();
  await expect(page.locator(".pg-text-layer span").first()).toBeVisible();
  await page.screenshot({ path: "docs/assets/screenshots/workspace.png" });

  await page.getByLabel("资源范围").selectOption("all");
  await page.getByText("章节练习").click();
  await page.getByRole("button", { name: "保存为复习" }).first().click();
  await page.getByRole("button", { name: "复习", exact: true }).click();
  await page.getByRole("button", { name: /查看答案/ }).click();
  await page.screenshot({ path: "docs/assets/screenshots/review.png" });
  await page.getByRole("button", { name: "关闭复习工作区" }).click();

  await page.getByRole("button", { name: "AI Provider 设置" }).click();
  await expect(page.getByRole("dialog", { name: "AI Provider 设置" })).toBeVisible();
  await page.screenshot({ path: "docs/assets/screenshots/ai-settings.png" });
});
