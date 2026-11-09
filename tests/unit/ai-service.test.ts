import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildQuestionMessages, askQuestion } from "../../src/ai/service";
import type { ProviderConfig } from "../../src/ai/types";
import { clearAllLocalData } from "../../src/storage/repositories";
import type { ExerciseQuestion } from "../../src/exercises/types";

const question: ExerciseQuestion = {
  id: "q1",
  number: 1,
  stem: "主动阅读的核心是什么？",
  options: [
    { id: "a", label: "A", text: "只看标题" },
    { id: "b", label: "B", text: "带着问题阅读" },
  ],
  verifiedAnswer: "B",
  verifiedSource: "platform-verified",
  explanation: null,
};

const config: ProviderConfig = {
  id: "test-openai",
  kind: "openai-compatible",
  label: "Test",
  baseUrl: "https://api.example.test/v1",
  model: "free-model",
  apiKey: "test-key",
  enabled: true,
  allowPaid: false,
};

function chatResponse(text: string): Response {
  return new Response(
    JSON.stringify({
      model: "free-model",
      choices: [{ message: { content: text } }],
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    }),
    { headers: { "content-type": "application/json" } },
  );
}

describe("AI service", () => {
  beforeEach(async () => {
    await clearAllLocalData();
  });

  it("builds a question-scoped prompt without platform credentials", () => {
    const messages = buildQuestionMessages(question, "hint", "B");
    const prompt = messages.map((message) => message.content).join("\n");
    expect(prompt).toContain("主动阅读的核心是什么");
    expect(prompt).toContain("平台提供的参考答案");
    expect(prompt).not.toContain("prd-access-token");
    expect(prompt).not.toContain("secret-token");
  });

  it("refuses external requests without explicit consent", async () => {
    await expect(
      askQuestion({ question, mode: "hint", userAnswer: "", configs: [config], consent: false }),
    ).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
  });

  it("uses the selected provider and caches the response", async () => {
    const fetchImpl = vi.fn(async () =>
      chatResponse("先判断作者提出的问题。"),
    ) as unknown as typeof fetch;
    const first = await askQuestion({
      question,
      mode: "hint",
      userAnswer: "",
      configs: [config],
      consent: true,
      fetchImpl,
    });
    const second = await askQuestion({
      question,
      mode: "hint",
      userAnswer: "",
      configs: [config],
      consent: true,
      fetchImpl,
    });
    expect(first.text).toContain("作者提出");
    expect(second.text).toBe(first.text);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("blocks a paid OpenRouter model when paid use is not allowed", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [{ id: "paid-model", pricing: { prompt: "0.001", completion: "0.002" } }],
          }),
          { headers: { "content-type": "application/json" } },
        ),
    ) as unknown as typeof fetch;
    await expect(
      askQuestion({
        question,
        mode: "explanation",
        userAnswer: "",
        configs: [
          {
            ...config,
            id: "openrouter-test",
            kind: "openrouter",
            label: "OpenRouter",
            baseUrl: "https://openrouter.example.test/api/v1",
            model: "paid-model",
          },
        ],
        consent: true,
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: "ALL_PROVIDERS_FAILED" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

it("falls back to a second configured provider after a failure", async () => {
  const fetchImpl = vi.fn(async (url: string | URL | Request) => {
    if (String(url).includes("first.example.test")) {
      return new Response("provider down", { status: 500 });
    }
    return chatResponse("来自备用 Provider 的提示。");
  }) as unknown as typeof fetch;
  const response = await askQuestion({
    question,
    mode: "hint",
    userAnswer: "",
    configs: [
      { ...config, id: "first", baseUrl: "https://first.example.test/v1", model: "first-model" },
      { ...config, id: "second", baseUrl: "https://second.example.test/v1", model: "second-model" },
    ],
    consent: true,
    fetchImpl,
  });
  expect(response.text).toContain("备用 Provider");
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});
