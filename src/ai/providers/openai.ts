import { AiError, classifyHttpError } from "../errors";
import type { AiRequest, AiResponse, ModelInfo, ProviderConfig } from "../types";

const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) throw new AiError("RESPONSE_TOO_LARGE", "模型响应过大");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AiError("INVALID_RESPONSE", "模型服务返回了无法解析的数据");
  }
}

function headers(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export async function discoverOpenAiModels(
  config: ProviderConfig,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<ModelInfo[]> {
  const response = await fetchImpl(`${config.baseUrl.replace(/\/$/, "")}/models`, {
    headers: headers(apiKey),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw classifyHttpError(response.status);
  const body = (await readJson(response)) as {
    data?: Array<{
      id?: string;
      name?: string;
      pricing?: { prompt?: string | number; completion?: string | number };
      context_length?: number;
      architecture?: { input_modalities?: string[] };
    }>;
  };
  return (body.data ?? [])
    .filter((model) => typeof model.id === "string" && model.id)
    .map((model) => {
      const prompt = Number(model.pricing?.prompt ?? NaN);
      const completion = Number(model.pricing?.completion ?? NaN);
      const free =
        Number.isFinite(prompt) && Number.isFinite(completion)
          ? prompt === 0 && completion === 0
          : null;
      return {
        id: model.id!,
        label: model.name ?? model.id!,
        free,
        supportsVision: model.architecture?.input_modalities?.includes("image") ?? false,
        contextLength: model.context_length,
      };
    });
}

export async function chatOpenAiCompatible(
  config: ProviderConfig,
  apiKey: string,
  request: AiRequest,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<AiResponse> {
  const response = await fetchImpl(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 1200,
    }),
    signal: signal ?? AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw classifyHttpError(response.status);
  const body = (await readJson(response)) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new AiError("EMPTY_RESPONSE", "模型没有返回文本内容");
  return {
    text,
    model: body.model ?? request.model,
    usage: {
      inputTokens: body.usage?.prompt_tokens,
      outputTokens: body.usage?.completion_tokens,
    },
  };
}
