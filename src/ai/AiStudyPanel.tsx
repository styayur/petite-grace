import { useState } from "preact/hooks";
import type { ExerciseQuestion } from "../exercises/types";
import type { AiResponse, ProviderConfig } from "./types";
import { askQuestion, type AiStudyMode } from "./service";

interface AiStudyPanelProps {
  question: ExerciseQuestion;
  configs: ProviderConfig[];
  onOpenSettings: () => void;
  onNotify: (message: string, tone?: "info" | "error") => void;
  onCreateReview: (question: ExerciseQuestion, aiText: string | null) => void;
}

export function AiStudyPanel({
  question,
  configs,
  onOpenSettings,
  onNotify,
  onCreateReview,
}: AiStudyPanelProps) {
  const enabled = configs.filter((config) => config.enabled && config.model && config.apiKey);
  const [providerId, setProviderId] = useState(enabled[0]?.id ?? "");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState<AiStudyMode | null>(null);
  const [result, setResult] = useState<AiResponse | null>(null);
  const [mode, setMode] = useState<AiStudyMode | null>(null);
  const [userAnswer, setUserAnswer] = useState("");

  const run = async (nextMode: AiStudyMode) => {
    if (!consent) {
      onNotify("请先勾选本次发送同意", "info");
      return;
    }
    if (enabled.length === 0) {
      onNotify("请先在设置中启用并配置 AI Provider", "info");
      onOpenSettings();
      return;
    }
    setLoading(nextMode);
    setMode(nextMode);
    try {
      const response = await askQuestion({
        question,
        mode: nextMode,
        userAnswer,
        configs,
        consent,
        selectedProviderId: providerId,
      });
      setResult(response);
    } catch (reason) {
      onNotify(reason instanceof Error ? reason.message : "AI 请求失败", "error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <section class="pg-ai-panel" aria-label="AI 学习辅助">
      <div class="pg-ai-consent">
        <strong>AI 学习辅助</strong>
        <p>只发送当前题目和你的作答，不发送 Cookie、Token、成绩或整门课程。</p>
        <label class="pg-checkbox">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent((event.currentTarget as HTMLInputElement).checked)}
          />
          允许将当前题目发送到所选 Provider
        </label>
      </div>
      {enabled.length > 0 ? (
        <select
          class="pg-select"
          value={providerId}
          onChange={(event) => setProviderId((event.currentTarget as HTMLSelectElement).value)}
          aria-label="AI Provider"
        >
          {enabled.map((config) => (
            <option key={config.id} value={config.id}>
              {config.label} · {config.model}
            </option>
          ))}
        </select>
      ) : null}
      <textarea
        class="pg-textarea"
        value={userAnswer}
        onInput={(event) => setUserAnswer((event.currentTarget as HTMLTextAreaElement).value)}
        placeholder="先写下你的答案或思路（可选）"
        aria-label="你的作答或思路"
      />
      <div class="pg-ai-actions">
        <button
          class="pg-button"
          type="button"
          disabled={Boolean(loading)}
          onClick={() => void run("hint")}
        >
          {loading === "hint" ? "思考中…" : "关键提示"}
        </button>
        <button
          class="pg-button"
          type="button"
          disabled={Boolean(loading)}
          onClick={() => void run("explanation")}
        >
          {loading === "explanation" ? "解析中…" : "分步解析"}
        </button>
        <button
          class="pg-button"
          type="button"
          disabled={Boolean(loading)}
          onClick={() => void run("check")}
        >
          {loading === "check" ? "核对中…" : "答案核对"}
        </button>
        <button class="pg-button" type="button" onClick={onOpenSettings}>
          设置 Provider
        </button>
      </div>
      {result ? (
        <div class="pg-ai-result">
          <div class="pg-ai-result-meta">
            <span class="pg-badge">AI 推断</span>
            <span>
              {mode === "hint" ? "关键提示" : mode === "check" ? "答案核对" : "分步解析"} ·{" "}
              {result.model}
            </span>
          </div>
          <div class="pg-ai-result-text">{result.text}</div>
          <button
            class="pg-button"
            type="button"
            onClick={() => onCreateReview(question, result.text)}
          >
            保存为复习项目
          </button>
        </div>
      ) : null}
    </section>
  );
}
