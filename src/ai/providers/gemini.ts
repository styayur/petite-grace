import { AiError, classifyHttpError } from "../errors";
import type { AiRequest, AiResponse, ModelInfo, ProviderConfig } from "../types";

const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

function endpoint(baseUrl: string, path: string, apiKey: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${path}?key=${encodeURIComponent(apiKey)}`;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) throw new AiError("RESPONSE_TOO_LARGE", "模型响应过大");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AiError("INVALID_RESPONSE", "Gemini 返回了无法解析的数据");
  }
}

export async function discoverGeminiModels(
  config: ProviderConfig,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<ModelInfo[]> {
  const response = await fetchImpl(endpoint(config.baseUrl, "models", apiKey), {
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw classifyHttpError(response.status);
  const body = (await readJson(response)) as {
    models?: Array<{
      name?: string;
      displayName?: string;
      supportedGenerationMethods?: string[];
      inputTokenLimit?: number;
    }>;
  };
  return (body.models ?? [])
    .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
    .map((model) => ({
      id: (model.name ?? "").replace(/^models\//, ""),
      label: model.displayName ?? model.name ?? "Gemini",
      free: null,
      supportsVision: false,
      contextLength: model.inputTokenLimit,
    }))
    .filter((model) => Boolean(model.id));
}

export async function chatGemini(
  config: ProviderConfig,
  apiKey: string,
  request: AiRequest,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<AiResponse> {
  const system = request.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n");
  const contents = request.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
  const response = await fetchImpl(
    endpoint(config.baseUrl, `models/${encodeURIComponent(request.model)}:generateContent`, apiKey),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents,
        generationConfig: {
          temperature: request.temperature ?? 0.2,
          maxOutputTokens: request.maxTokens ?? 1200,
        },
      }),
      signal: signal ?? AbortSignal.timeout(60_000),
    },
  );
  if (!response.ok) throw classifyHttpError(response.status);
  const body = (await readJson(response)) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = body.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("\n")
    .trim();
  if (!text) throw new AiError("EMPTY_RESPONSE", "Gemini 没有返回文本内容");
  return {
    text,
    model: request.model,
    usage: {
      inputTokens: body.usageMetadata?.promptTokenCount,
      outputTokens: body.usageMetadata?.candidatesTokenCount,
    },
  };
}
