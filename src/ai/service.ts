import type { ExerciseQuestion } from "../exercises/types";
import { aiCacheRepository } from "../storage/repositories";
import { AiError } from "./errors";
import { completeWithProvider, listModels } from "./providers/registry";
import type { AiMessage, AiResponse, ModelInfo, ProviderConfig } from "./types";

export type AiStudyMode = "hint" | "explanation" | "check";

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const lastCallByProvider = new Map<string, number>();
const modelsByProvider = new Map<string, ModelInfo[]>();

export interface AskQuestionOptions {
  question: ExerciseQuestion;
  mode: AiStudyMode;
  userAnswer: string;
  configs: ProviderConfig[];
  consent: boolean;
  selectedProviderId?: string | null;
  allowFallback?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  signal?: AbortSignal;
}

function modeInstruction(mode: AiStudyMode): string {
  if (mode === "hint") {
    return "只提供关键知识点提示，不直接给出完整答案。用 2-4 个短段落引导用户思考。";
  }
  if (mode === "check") {
    return "核对用户答案：指出正确、错误和遗漏之处，再给出改进建议。不要声称这是平台已验证答案。";
  }
  return "分步骤解析题目，最后给出参考答案。先讲思路，再讲推理，最后总结。不要声称这是平台已验证答案。";
}

export function buildQuestionMessages(
  question: ExerciseQuestion,
  mode: AiStudyMode,
  userAnswer: string,
): AiMessage[] {
  const options = question.options.map((option) => `${option.label}. ${option.text}`).join("\n");
  const reference = question.verifiedAnswer
    ? `平台提供的参考答案（仅用于核对，不得改写成平台验证）：${question.verifiedAnswer}`
    : "平台没有提供可验证参考答案。";
  return [
    {
      role: "system",
      content:
        "你是 Petite Grace 的学习辅助助手。使用简体中文，只依据用户提供的当前题目回答。" +
        "不索取或输出身份信息、Cookie、Token、成绩或整门课程内容。不要编造引用或平台验证状态。" +
        "明确区分 AI 推断与平台已提供的参考答案。",
    },
    {
      role: "user",
      content:
        `任务：${modeInstruction(mode)}\n\n` +
        `题目 ${question.number}：${question.stem}\n` +
        (options ? `选项：\n${options}\n` : "") +
        `用户当前作答：${userAnswer.trim() || "尚未作答"}\n` +
        `${reference}`,
    },
  ];
}

async function hashValue(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function waitForRateLimit(providerId: string): Promise<void> {
  const now = Date.now();
  const last = lastCallByProvider.get(providerId) ?? 0;
  const wait = Math.max(0, 1100 - (now - last));
  if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
  lastCallByProvider.set(providerId, Date.now());
}

async function modelIsAllowed(config: ProviderConfig, fetchImpl: typeof fetch): Promise<boolean> {
  if (config.allowPaid || config.kind !== "openrouter") return true;
  try {
    let models = modelsByProvider.get(config.id);
    if (!models) {
      models = await listModels(config, config.apiKey ?? "", fetchImpl);
      modelsByProvider.set(config.id, models);
    }
    const model = models.find((item) => item.id === config.model);
    return model?.free === true;
  } catch {
    return false;
  }
}

export async function askQuestion(options: AskQuestionOptions): Promise<AiResponse> {
  if (!options.consent) {
    throw new AiError("CONSENT_REQUIRED", "请先允许将当前题目发送到所选模型服务");
  }
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  const now = options.now ?? (() => new Date());
  const enabled = options.configs.filter(
    (config) => config.enabled && config.model && config.apiKey,
  );
  if (enabled.length === 0) {
    throw new AiError("NO_PROVIDER", "没有可用的 AI Provider，请先在设置中配置 API Key 和模型");
  }
  const selected = options.selectedProviderId
    ? enabled.find((config) => config.id === options.selectedProviderId)
    : enabled[0];
  const ordered = selected
    ? [selected, ...enabled.filter((config) => config.id !== selected.id)]
    : enabled;
  const candidates = options.allowFallback === false ? ordered.slice(0, 1) : ordered;
  const messages = buildQuestionMessages(options.question, options.mode, options.userAnswer);
  const failures: string[] = [];

  for (const config of candidates) {
    if (!(await modelIsAllowed(config, fetchImpl))) {
      failures.push(`${config.label}: 未确认模型免费，已阻止自动付费调用`);
      continue;
    }
    const cacheKey = await hashValue(
      JSON.stringify({ provider: config.id, model: config.model, messages }),
    );
    const cached = await aiCacheRepository.get(cacheKey);
    if (cached && now().getTime() - new Date(cached.createdAt).getTime() < CACHE_TTL_MS) {
      return cached.value;
    }
    try {
      await waitForRateLimit(config.id);
      const response = await completeWithProvider(
        config,
        config.apiKey!,
        { providerId: config.id, model: config.model, messages, temperature: 0.2, maxTokens: 1200 },
        fetchImpl,
        options.signal,
      );
      await aiCacheRepository.put({
        key: cacheKey,
        value: response,
        createdAt: now().toISOString(),
      });
      return response;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "未知错误";
      failures.push(`${config.label}: ${message}`);
    }
  }

  throw new AiError(
    "ALL_PROVIDERS_FAILED",
    failures.length ? failures.join("；") : "所有模型服务均不可用",
  );
}
