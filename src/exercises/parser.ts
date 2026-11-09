import type { ExerciseOption, ExerciseQuestion, ExerciseSet } from "./types";

function textOf(element: Element): string {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

function firstBySelectors(root: ParentNode, selectors: string[]): Element | null {
  for (const selector of selectors) {
    const element = root.querySelector(selector);
    if (element) return element;
  }
  return null;
}

function allBySelectors(root: ParentNode, selectors: string[]): Element[] {
  const seen = new Set<Element>();
  const result: Element[] = [];
  for (const selector of selectors) {
    for (const element of Array.from(root.querySelectorAll(selector))) {
      if (!seen.has(element)) {
        seen.add(element);
        result.push(element);
      }
    }
  }
  return result;
}

function questionId(element: Element, index: number): string {
  return (
    element.getAttribute("data-question-id") ??
    element.getAttribute("data-id") ??
    element.id ??
    `question-${index + 1}`
  );
}

function parseOptions(question: Element): ExerciseOption[] {
  const optionNodes = allBySelectors(question, [
    ".option",
    ".answer-item",
    ".que-option",
    ".question-option",
    "label.choice",
    "[data-option-id]",
  ]);
  const seen = new Set<string>();
  return optionNodes.flatMap((option, index) => {
    const text = textOf(option);
    if (!text || seen.has(text)) return [];
    seen.add(text);
    const input = option.querySelector("input");
    const label =
      option.getAttribute("data-option-label") ??
      input?.getAttribute("value") ??
      String.fromCharCode(65 + index);
    return [
      {
        id: option.getAttribute("data-option-id") ?? `${questionId(question, index)}-${index}`,
        label,
        text,
      },
    ];
  });
}

function parseVerifiedAnswer(question: Element): { answer: string | null; source: string | null } {
  const answerNode = firstBySelectors(question, [
    ".correct-answer",
    ".reference-answer",
    ".verified-answer",
    "[data-correct-answer]",
    "[data-answer]",
  ]);
  const answer =
    answerNode?.getAttribute("data-correct-answer") ??
    answerNode?.getAttribute("data-answer") ??
    (answerNode ? textOf(answerNode) : null);
  if (!answer) return { answer: null, source: null };
  const source =
    answerNode?.getAttribute("data-source") ??
    (answerNode?.closest("[data-verified='true']") ? "platform-verified" : null);
  return { answer, source };
}

export function parseExercisesFromHtml(html: string, resourceId: string): ExerciseSet {
  const document = new DOMParser().parseFromString(html, "text/html");
  return parseExercisesFromDocument(document, resourceId, "html");
}

export function parseExercisesFromDocument(
  document: Document,
  resourceId: string,
  parsedFrom: ExerciseSet["parsedFrom"] = "host-dom",
): ExerciseSet {
  const nodes = allBySelectors(document, [
    "[data-question-id]",
    ".question-item",
    ".subject_node",
    ".question",
    ".que-item",
    ".exam-question",
  ]);
  const warnings: string[] = [];
  const unique = nodes.filter((node, index) => nodes.indexOf(node) === index);
  const questions: ExerciseQuestion[] = unique.map((node, index) => {
    const stemNode = firstBySelectors(node, [
      ".question-title",
      ".subject-title",
      ".stem",
      ".q-title",
      ".question-stem",
      ".title",
    ]);
    const stem = stemNode ? textOf(stemNode) : textOf(node);
    const { answer, source } = parseVerifiedAnswer(node);
    return {
      id: questionId(node, index),
      number: index + 1,
      stem,
      options: parseOptions(node),
      verifiedAnswer: answer,
      verifiedSource: source,
      explanation: firstBySelectors(node, [".explanation", ".analysis", ".answer-analysis"])
        ? textOf(firstBySelectors(node, [".explanation", ".analysis", ".answer-analysis"])!)
        : null,
    };
  });

  if (questions.length === 0) {
    warnings.push("未识别到题目结构；可下载原始作业或返回平台页面查看。");
  }
  return {
    resourceId,
    title: document.title || "作业",
    questions,
    parsedFrom,
    warnings,
  };
}
