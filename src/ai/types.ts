export type ProviderKind = "groq" | "openrouter" | "gemini" | "openai-compatible";

export interface ProviderConfig {
  id: string;
  kind: ProviderKind;
  label: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  enabled: boolean;
  allowPaid: boolean;
  lastVerifiedAt?: string;
}

export interface ModelInfo {
  id: string;
  label: string;
  free: boolean | null;
  supportsVision: boolean;
  contextLength?: number;
}

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiRequest {
  providerId: string;
  model: string;
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface AiResponse {
  text: string;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}
