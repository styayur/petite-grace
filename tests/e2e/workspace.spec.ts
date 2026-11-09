import { expect, test } from "@playwright/test";

test("opens the workspace and navigates chapters and resources", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tests/harness/");
  await expect(page.getByText("Petite Grace").first()).toBeVisible();
  await expect(page.getByRole("tree", { name: "课程章节树" })).toContainText("第一章 课程导论");

  await page.getByText("第二章 阅读方法").click();
  await expect(page.getByRole("tree", { name: "课程资源列表" })).toContainText("阅读方法讲义.pdf");

  await page.getByLabel("资源范围").selectOption("all");
  await page.getByText("课程导论.pptx").click();
  await expect(page.getByText("Petite Grace PPTX")).toBeVisible();
  await expect(page.getByText("第 2 页有 1 个图表、表格或复杂对象未完整渲染")).toBeVisible();

  await page.getByRole("button", { name: "显示或隐藏信息栏" }).click();
  await expect(page.getByRole("complementary", { name: "资源信息" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("renders a continuous PDF, switches layout and restores progress", async ({ page }) => {
  await page.goto("/tests/harness/");
  await expect(page.locator(".pg-pdf-page")).toHaveCount(30);
  await expect(page.locator(".pg-pdf-page canvas"))
    .toHaveCount(2, { timeout: 5000 })
    .catch(() => undefined);
  await expect(page.getByLabel("第 1 页")).toBeVisible();
  await page.getByLabel("PDF 页面布局").selectOption("double");
  await expect(page.locator(".pg-pdf-scroll")).toHaveAttribute("data-layout", "double");

  await page.getByLabel("跳转页码").fill("3");
  await page.getByLabel("跳转页码").press("Enter");
  await expect(page.getByLabel("跳转页码")).toHaveValue("3");
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.getByLabel("PDF 页面布局")).toHaveValue("double");
  await expect(page.getByLabel("跳转页码")).toHaveValue("3");
});

test("creates, edits and restores a PDF highlight annotation", async ({ page }) => {
  await page.goto("/tests/harness/");
  const textSpan = page.locator(".pg-pdf-scroll .pg-text-layer span").first();
  await expect(textSpan).toBeVisible();
  await textSpan.selectText();
  await page.locator(".pg-pdf-scroll").dispatchEvent("mouseup");
  await expect(page.getByRole("toolbar", { name: "划线操作" })).toBeVisible();
  await page.getByRole("button", { name: "使用yellow划线" }).click();
  await expect(page.locator(".pg-highlight")).toHaveCount(1);
  await expect(page.locator(".pg-annotation-item")).toHaveCount(1);
  await page.getByLabel("PDF 缩放模式").selectOption("fit-page");
  await expect(page.locator(".pg-highlight")).toBeVisible();

  await page.getByLabel("当前标注注释").fill("需要复习的定义");
  await page.getByRole("button", { name: "保存" }).click();
  await page.reload();
  await expect(page.locator(".pg-annotation-item")).toHaveCount(1);
  await page.locator(".pg-annotation-item").click();
  await expect(page.getByLabel("当前标注注释")).toHaveValue("需要复习的定义");
});
