import type { ChapterNode, CourseSnapshot } from "./types";

export type CourseSortMode = "platform" | "chapter-number" | "local";
export type ChapterOrderDirection = "up" | "down";
export type ChapterOrderOverrides = Record<string, string[]>;

const ROOT_ORDER_KEY = "__root__";
const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });

const CHINESE_DIGITS: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  壹: 1,
  二: 2,
  两: 2,
  贰: 2,
  三: 3,
  叁: 3,
  四: 4,
  肆: 4,
  五: 5,
  伍: 5,
  六: 6,
  陆: 6,
  七: 7,
  柒: 7,
  八: 8,
  捌: 8,
  九: 9,
  玖: 9,
};

const CHINESE_UNITS: Record<string, number> = {
  十: 10,
  拾: 10,
  百: 100,
  佰: 100,
  千: 1000,
  仟: 1000,
  万: 10000,
  萬: 10000,
};

function normalizeWidth(value: string): string {
  return value.replace(/[０-９]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) - 0xfee0),
  );
}

export function chineseNumeralToNumber(value: string): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  let total = 0;
  let section = 0;
  let digit = 0;
  let sawCharacter = false;

  for (const character of value) {
    if (character in CHINESE_DIGITS) {
      digit = CHINESE_DIGITS[character]!;
      sawCharacter = true;
      continue;
    }
    const unit = CHINESE_UNITS[character];
    if (!unit) return null;
    sawCharacter = true;
    if (unit === 10000) {
      section += digit;
      total += (section || 1) * unit;
      section = 0;
      digit = 0;
    } else {
      section += (digit || 1) * unit;
      digit = 0;
    }
  }
  if (!sawCharacter) return null;
  return total + section + digit;
}

export interface ChapterNumber {
  segments: number[];
  raw: string;
}

export function parseChapterNumber(title: string): ChapterNumber | null {
  const normalized = normalizeWidth(title.trim());
  if (!normalized) return null;

  const patterns: RegExp[] = [
    /第\s*([0-9]+(?:\.[0-9]+)*|[零〇一壹二两贰三叁四肆五伍六陆七柒八捌九玖十拾百佰千仟万萬]+)\s*(?:章|节|節|讲|講|课|課|单元|單元|部分|篇|课次|課次)?/,
    /^\s*(?:chapter|unit|lesson|section|module)\s*([0-9]+(?:\.[0-9]+)*)/i,
    /^\s*[（(【[]?\s*([0-9]+(?:\.[0-9]+)*)\s*[）)】\]]?(?:\s|[、.．:：\-—_]|$)/,
    /^\s*[（(【[]?\s*([零〇一壹二两贰三叁四肆五伍六陆七柒八捌九玖十拾百佰千仟万萬]+)\s*[）)】\]]?(?:\s|[、.．:：\-—_]|$)/,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(normalized);
    const raw = match?.[1];
    if (!raw) continue;
    const segments = raw
      .split(".")
      .map((segment) => chineseNumeralToNumber(segment))
      .filter((segment): segment is number => segment !== null);
    if (segments.length) return { segments, raw };
  }
  return null;
}

function compareSegments(a: number[], b: number[]): number {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const aValue = a[index] ?? 0;
    const bValue = b[index] ?? 0;
    if (aValue !== bValue) return aValue - bValue;
  }
  return 0;
}

export function compareChapterTitles(aTitle: string, bTitle: string): number {
  const a = parseChapterNumber(aTitle);
  const b = parseChapterNumber(bTitle);
  if (a && b) {
    const segmentComparison = compareSegments(a.segments, b.segments);
    if (segmentComparison !== 0) return segmentComparison;
  } else if (a) {
    return -1;
  } else if (b) {
    return 1;
  }
  return collator.compare(aTitle, bTitle);
}

function orderKeyForParent(parentId: string | null): string {
  return parentId ?? ROOT_ORDER_KEY;
}

function stableNaturalSortIds(ids: string[], chapters: Map<string, ChapterNode>): string[] {
  const numbered = ids.filter((id) => {
    const chapter = chapters.get(id);
    return chapter ? Boolean(parseChapterNumber(chapter.title)) : false;
  });
  numbered.sort((a, b) =>
    compareChapterTitles(chapters.get(a)?.title ?? "", chapters.get(b)?.title ?? ""),
  );
  let numberedIndex = 0;
  return ids.map((id) => {
    const chapter = chapters.get(id);
    if (!chapter || !parseChapterNumber(chapter.title)) return id;
    return numbered[numberedIndex++] ?? id;
  });
}

function orderIdsWithOverride(ids: string[], override: string[] | undefined): string[] {
  if (!override?.length) return ids;
  const allowed = new Set(ids);
  const seen = new Set<string>();
  const ordered = override.filter((id) => {
    if (!allowed.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  for (const id of ids) {
    if (!seen.has(id)) ordered.push(id);
  }
  return ordered;
}

export function applyCourseOrdering(
  course: CourseSnapshot,
  mode: CourseSortMode,
  overrides: ChapterOrderOverrides = {},
): CourseSnapshot {
  const chapters = course.chapters.map((chapter) => ({
    ...chapter,
    childChapterIds: [...chapter.childChapterIds],
  }));
  const chapterMap = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const orderSiblings = (ids: string[], parentId: string | null): string[] => {
    if (mode === "chapter-number") return stableNaturalSortIds(ids, chapterMap);
    if (mode === "local") return orderIdsWithOverride(ids, overrides[orderKeyForParent(parentId)]);
    return ids;
  };

  const rootChapterIds = orderSiblings([...course.rootChapterIds], null);
  for (const chapter of chapters) {
    chapter.childChapterIds = orderSiblings(chapter.childChapterIds, chapter.id);
  }
  return {
    ...course,
    chapters,
    rootChapterIds,
    appliedOrder: mode,
  };
}

export function moveChapterInOrder(
  course: CourseSnapshot,
  overrides: ChapterOrderOverrides,
  chapterId: string,
  direction: ChapterOrderDirection,
): ChapterOrderOverrides {
  const chapter = course.chapters.find((item) => item.id === chapterId);
  if (!chapter) return overrides;
  const parentId = chapter.parentId;
  const siblings =
    parentId && course.chapters.some((item) => item.id === parentId)
      ? (course.chapters.find((item) => item.id === parentId)?.childChapterIds ?? [])
      : course.rootChapterIds;
  const current = orderIdsWithOverride(siblings, overrides[orderKeyForParent(parentId)]);
  const index = current.indexOf(chapterId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return overrides;
  const next = [...current];
  [next[index], next[targetIndex]] = [next[targetIndex]!, next[index]!];
  return {
    ...overrides,
    [orderKeyForParent(parentId)]: next,
  };
}

export function orderingLabel(course: CourseSnapshot, mode: CourseSortMode): string {
  if (mode === "local") return "本地自定义顺序";
  if (mode === "chapter-number") return "章节编号自然排序（中文/阿拉伯数字）";
  return course.sortEvidence === "explicit-order-field"
    ? "平台显式顺序字段"
    : "平台原始响应顺序（回退）";
}
