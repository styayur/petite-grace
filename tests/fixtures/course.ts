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
  {
    id: "2006",
    name: "大学物理实验课程第一章绪论与测量误差分析及数据处理方法补充讲义（含实验安全规范与预习要求完整版）2026年秋季学期最终修订版.pdf",
    mimetype: "application/pdf",
    parent_id: "1001",
    quote_id: "q-2006",
    sort: 3,
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
    id: "2007",
    name: "课程视频：阅读方法示例.mp4",
    mimetype: "video/mp4",
    parent_id: "1003",
    quote_id: "q-2007",
    sort: 3,
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

export const orderingCourseFixture = mapCourseSnapshot({
  courseId: "9876543210987654321",
  visit: { name: "真实课程排序回归", site_id: "site-order", teachers: [{ name: "测试教师" }] },
  resources: [
    { id: "c10", name: "第十章 总结", type: "folder", parent_id: null, sort: 1 },
    { id: "c2", name: "第二章 方法", type: "folder", parent_id: null, sort: 2 },
    { id: "c11", name: "第十一章 扩展", type: "folder", parent_id: null, sort: 3 },
    { id: "c3", name: "第3章 实践", type: "folder", parent_id: null, sort: 4 },
    { id: "c1", name: "第一章 导论", type: "folder", parent_id: null, sort: 5 },
    {
      id: "order-resource",
      name: "第一章导论与课程目标说明以及完整阅读要求（超长讲义文件名回归样本）.pdf",
      mimetype: "application/pdf",
      parent_id: "c1",
      quote_id: "q-order-long",
      sort: 1,
    },
  ],
  fetchedAt: "2026-11-10T00:00:00.000Z",
  source: "fixture",
});
