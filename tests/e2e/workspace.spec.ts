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
  await expect
    .poll(async () => page.locator(".pg-pdf-page canvas").count(), { timeout: 5000 })
    .toBeLessThan(12);
  await expect(page.getByLabel("第 1 页")).toBeVisible();
  await page.getByLabel("PDF 页面布局").selectOption("double");
  await expect(page.locator(".pg-pdf-scroll")).toHaveAttribute("data-layout", "double");

  await page.getByLabel("搜索 PDF 全文").fill("Petite Grace PDF page 3");
  await page.getByRole("button", { name: "执行搜索" }).click();
  await expect(page.locator(".pg-search-result").first()).toBeVisible();
  await page.locator(".pg-search-result").first().click();
  await expect(page.getByLabel("跳转页码")).toHaveValue("3");
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
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.reload();
  await expect(page.locator(".pg-annotation-item")).toHaveCount(1);
  await page.locator(".pg-annotation-item").click();
  await expect(page.getByLabel("当前标注注释")).toHaveValue("需要复习的定义");
  await page.getByRole("button", { name: "保存为复习" }).click();
  await expect(page.getByText("已将划线保存为复习项目")).toBeVisible();
  await page.getByRole("button", { name: "复习", exact: true }).click();
  await expect(page.locator(".pg-review-front")).toHaveText("需要复习的定义");
});

test("reads exercises, keeps local status and exposes opt-in AI settings", async ({ page }) => {
  await page.goto("/tests/harness/");
  await page.getByLabel("资源范围").selectOption("all");
  await page.getByText("章节练习").click();
  await expect(page.getByText("哪一个选项体现了主动阅读？", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "标记完成" }).click();
  await expect(page.getByRole("button", { name: "第 1 题" })).toHaveAttribute(
    "data-status",
    "completed",
  );
  await page.getByRole("button", { name: "第 2 题" }).click();
  await expect(page.getByText("平台没有提供可验证参考答案", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "关键提示" }).click();
  await expect(page.getByText("请先勾选本次发送同意")).toBeVisible();
  await page.getByRole("button", { name: "AI Provider 设置" }).click();
  await expect(page.getByRole("dialog", { name: "AI Provider 设置" })).toBeVisible();
  await page.getByRole("button", { name: "关闭设置" }).click();
  await page.reload();
  await page.getByLabel("资源范围").selectOption("all");
  await page.getByText("章节练习").click();
  await expect(page.getByRole("button", { name: "第 1 题" })).toHaveAttribute(
    "data-status",
    "completed",
  );
});

test("creates and completes a review card", async ({ page }) => {
  await page.goto("/tests/harness/");
  await page.getByLabel("资源范围").selectOption("all");
  await page.getByText("章节练习").click();
  await page.getByRole("button", { name: "保存为复习" }).first().click();
  await expect(page.getByText("已保存为复习项目")).toBeVisible();
  await page.getByRole("button", { name: "复习", exact: true }).click();
  await expect(page.getByRole("region", { name: "复习工作区" })).toBeVisible();
  await expect(page.locator(".pg-review-front")).toContainText("主动阅读");
  await page.getByRole("button", { name: /查看答案/ }).click();
  await expect(page.locator(".pg-review-back")).toContainText("B");
  await page.getByRole("button", { name: /良好/ }).click();
  await expect(page.getByText("今天的复习完成了")).toBeVisible();
});

test("supports keyboard focus mode and a narrow responsive viewport", async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 820 });
  await page.goto("/tests/harness/");
  await expect(page.locator(".pg-shell")).toBeVisible();
  await page.keyboard.press("f");
  await expect(page.locator(".pg-workspace")).toHaveClass(/no-left/);
  await expect(page.locator(".pg-workspace")).toHaveClass(/no-right/);
  await page.keyboard.press("f");
  await expect(page.locator(".pg-workspace")).not.toHaveClass(/no-left/);
  await page.getByRole("button", { name: "阅读显示设置" }).click();
  await expect(page.getByRole("dialog", { name: "阅读显示设置" })).toBeVisible();
  await page.getByLabel("文字大小 · 100%").evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = "1.2";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.getByRole("button", { name: "完成" }).click();
  await expect(page.locator(".pg-shell")).toHaveAttribute(
    "style",
    /--pg-reader-font-scale:\s*1\.2/,
  );
});
