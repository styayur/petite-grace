import { expect, test } from "@playwright/test";

test("uses natural chapter ordering, local overrides, long titles and persistent pane widths", async ({
  page,
}) => {
  await page.goto("/tests/harness/?ordering=1");
  const rootLabels = page.locator(".pg-tree > div > .pg-tree-row .pg-tree-label");
  await expect(rootLabels).toHaveText([
    "第十章 总结",
    "第二章 方法",
    "第十一章 扩展",
    "第3章 实践",
    "第一章 导论",
  ]);

  await page.getByLabel("排序", { exact: true }).selectOption("chapter-number");
  await expect(rootLabels).toHaveText([
    "第一章 导论",
    "第二章 方法",
    "第3章 实践",
    "第十章 总结",
    "第十一章 扩展",
  ]);
  await page.getByRole("button", { name: "上移章节：第十一章 扩展" }).click();
  await expect(page.getByLabel("排序", { exact: true })).toHaveValue("local");
  await expect(rootLabels).toHaveText([
    "第一章 导论",
    "第二章 方法",
    "第3章 实践",
    "第十一章 扩展",
    "第十章 总结",
  ]);

  const longLabel = page
    .locator(".pg-resource-label")
    .filter({ hasText: "第一章导论与课程目标" })
    .first();
  await expect(longLabel).not.toHaveClass(/expanded/);
  await page.getByRole("button", { name: /展开完整标题：第一章导论与课程目标/ }).click();
  await expect(longLabel).toHaveClass(/expanded/);

  const splitter = page.getByRole("separator", { name: "调整章节栏宽度" });
  const box = await splitter.boundingBox();
  if (!box) throw new Error("Left pane splitter not visible");
  await page.mouse.move(box.x + 4, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x + 64, box.y + 120, { steps: 5 });
  await page.mouse.up();
  const widthAfterDrag = await page
    .locator(".pg-workspace")
    .evaluate((element) =>
      parseFloat((element as HTMLElement).style.getPropertyValue("--pg-left-width")),
    );
  expect(widthAfterDrag).toBeGreaterThan(300);

  await page.reload();
  const widthAfterReload = await page
    .locator(".pg-workspace")
    .evaluate((element) =>
      parseFloat((element as HTMLElement).style.getPropertyValue("--pg-left-width")),
    );
  expect(widthAfterReload).toBeGreaterThan(300);
});
