export class AiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export function classifyHttpError(status: number): AiError {
  if (status === 401 || status === 403)
    return new AiError("AUTH_ERROR", "API Key 无效或没有模型权限", status);
  if (status === 429) return new AiError("RATE_LIMIT", "模型服务达到速率或额度限制", status);
  if (status >= 500) return new AiError("PROVIDER_UNAVAILABLE", "模型服务暂时不可用", status);
  return new AiError("PROVIDER_ERROR", `模型请求失败（HTTP ${status}）`, status);
}
