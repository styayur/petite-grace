import { describe, expect, it } from "vitest";
import { mapCourseSnapshot } from "../../src/platform/xiaoya/mapping";
import {
  applyCourseOrdering,
  chineseNumeralToNumber,
  compareChapterTitles,
  moveChapterInOrder,
  parseChapterNumber,
} from "../../src/platform/xiaoya/ordering";

function courseWith(titles: Array<{ id: string; name: string; sort?: number }>) {
  return mapCourseSnapshot({
    courseId: "ordering-course",
    resources: titles.map((item) => ({
      id: item.id,
      name: item.name,
      type: "folder",
      sort: item.sort,
    })),
    source: "fixture",
  });
}

describe("chapter ordering", () => {
  it("converts Chinese and Arabic chapter numbers", () => {
    expect(chineseNumeralToNumber("十一")).toBe(11);
    expect(chineseNumeralToNumber("二十一")).toBe(21);
    expect(chineseNumeralToNumber("一百零二")).toBe(102);
    expect(parseChapterNumber("第十一章 总复习")?.segments).toEqual([11]);
    expect(parseChapterNumber("1.10 混合编号")?.segments).toEqual([1, 10]);
  });

  it("sorts mixed Chinese/Arabic numbered chapters while keeping unnumbered slots stable", () => {
    const course = courseWith([
      { id: "c10", name: "第十章 总结" },
      { id: "c2", name: "第二章 方法" },
      { id: "c11", name: "第十一章 扩展" },
      { id: "c3", name: "第3章 实践" },
      { id: "appendix", name: "附录" },
      { id: "c1", name: "第一章 导论" },
    ]);
    const ordered = applyCourseOrdering(course, "chapter-number");
    expect(ordered.rootChapterIds).toEqual(["c1", "c2", "c3", "c10", "appendix", "c11"]);
    expect(ordered.appliedOrder).toBe("chapter-number");
  });

  it("natural-sorts decimal chapter segments", () => {
    expect(compareChapterTitles("1.10 深入", "1.2 基础")).toBeGreaterThan(0);
    expect(compareChapterTitles("1.2 基础", "1.1 入门")).toBeGreaterThan(0);
  });

  it("applies a local order override without mutating platform data", () => {
    const course = courseWith([
      { id: "a", name: "第一章 A" },
      { id: "b", name: "第二章 B" },
      { id: "c", name: "第三章 C" },
    ]);
    const local = applyCourseOrdering(course, "local", { __root__: ["c", "a", "b"] });
    expect(local.rootChapterIds).toEqual(["c", "a", "b"]);
    expect(course.rootChapterIds).toEqual(["a", "b", "c"]);
  });

  it("moves a sibling chapter and records the override", () => {
    const course = courseWith([
      { id: "a", name: "第一章 A" },
      { id: "b", name: "第二章 B" },
      { id: "c", name: "第三章 C" },
    ]);
    const overrides = moveChapterInOrder(course, {}, "c", "up");
    expect(overrides.__root__).toEqual(["a", "c", "b"]);
  });
});
