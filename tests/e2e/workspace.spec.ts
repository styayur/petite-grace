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
  await expect(page.getByText("当前版本已识别 PPT/PPTX")).toBeVisible();

  await page.getByRole("button", { name: "显示或隐藏信息栏" }).click();
  await expect(page.getByRole("complementary", { name: "资源信息" })).toHaveCount(0);
  expect(errors).toEqual([]);
});
