import { mapCourseSnapshot } from "../../src/platform/xiaoya/mapping";

export const rawCourseFixture = [
  { id: "1001", name: "第一章 课程导论", type: "folder", parent_id: null, sort: 1 },
  { id: "1002", name: "1.1 学习目标", type: "folder", parent_id: "1001", sort: 1 },
  {
    id: "2001",
    name: "课程导论.pdf",
    mimetype: "application/pdf",
    parent_id: "1002",
    quote_id: "q-2001",
    sort: 1,
  },
  {
    id: "2002",
    name: "课程导论.pptx",
    mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    parent_id: "1002",
    quote_id: "q-2002",
    sort: 2,
  },
  { id: "1003", name: "第二章 阅读方法", type: "folder", parent_id: null, sort: 2 },
  {
    id: "2003",
    name: "阅读方法讲义.pdf",
    mimetype: "application/pdf",
    parent_id: "1003",
    quote_id: "q-2003",
    sort: 1,
  },
  {
    id: "2004",
    name: "章节练习",
    type: "assignment",
    parent_id: "1003",
    is_exercise: true,
    sort: 2,
  },
  {
    id: "2005",
    name: "补充图片.png",
    mimetype: "image/png",
    parent_id: null,
    quote_id: "q-2005",
    sort: 3,
  },
];

export const courseFixture = mapCourseSnapshot({
  courseId: "1234567890123456789",
  visit: { name: "理工智课 · 测试课程", site_id: "site-1", teachers: [{ name: "测试教师" }] },
  resources: rawCourseFixture,
  fetchedAt: "2026-11-10T00:00:00.000Z",
  source: "fixture",
});
