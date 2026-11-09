import type { AiRequest, AiResponse, ModelInfo, ProviderConfig } from "../types";
import { chatGemini, discoverGeminiModels } from "./gemini";
import { chatOpenAiCompatible, discoverOpenAiModels } from "./openai";

export const DEFAULT_PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    id: "groq",
    kind: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "",
    enabled: false,
    allowPaid: false,
  },
  {
    id: "openrouter",
    kind: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "",
    enabled: false,
    allowPaid: false,
  },
  {
    id: "gemini",
    kind: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "",
    enabled: false,
    allowPaid: false,
  },
  {
    id: "openai-compatible",
    kind: "openai-compatible",
    label: "OpenAI-compatible",
    baseUrl: "",
    model: "",
    enabled: false,
    allowPaid: false,
  },
];

export async function listModels(
  config: ProviderConfig,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<ModelInfo[]> {
  if (config.kind === "gemini") return discoverGeminiModels(config, apiKey, fetchImpl);
  return discoverOpenAiModels(config, apiKey, fetchImpl);
}

export async function completeWithProvider(
  config: ProviderConfig,
  apiKey: string,
  request: AiRequest,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<AiResponse> {
  if (config.kind === "gemini") return chatGemini(config, apiKey, request, fetchImpl, signal);
  return chatOpenAiCompatible(config, apiKey, request, fetchImpl, signal);
}
