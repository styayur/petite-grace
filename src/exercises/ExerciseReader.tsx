import { useEffect, useMemo, useState } from "preact/hooks";
import type { CourseAdapter, ResourceRecord } from "../platform/xiaoya/types";
import type { ExerciseQuestion, ExerciseSet, ExerciseState } from "./types";
import { parseExercisesFromDocument, parseExercisesFromHtml } from "./parser";
import { exerciseRepository } from "../storage/repositories";
import { AiStudyPanel } from "../ai/AiStudyPanel";
import type { ProviderConfig } from "../ai/types";
import { DownloadIcon } from "../ui/icons";
import { CheckIcon } from "../ui/icons";

interface ExerciseReaderProps {
  resource: ResourceRecord;
  adapter: CourseAdapter;
  providerConfigs: ProviderConfig[];
  onOpenAiSettings: () => void;
  onDownload: (resource: ResourceRecord) => void | Promise<void>;
  onNotify: (message: string, tone?: "info" | "error") => void;
  onCreateReview: (question: ExerciseQuestion, aiText: string | null) => void;
}

function stateKey(resourceId: string, questionId: string): string {
  return `${resourceId}:${questionId}`;
}

function defaultState(question: ExerciseQuestion, resourceId: string): ExerciseState {
  return {
    exerciseId: stateKey(resourceId, question.id),
    resourceId,
    viewed: false,
    completed: false,
    needsReview: false,
    userAnswer: "",
    updatedAt: new Date().toISOString(),
  };
}

export function ExerciseReader({
  resource,
  adapter,
  providerConfigs,
  onOpenAiSettings,
  onDownload,
  onNotify,
  onCreateReview,
}: ExerciseReaderProps) {
  const [exerciseSet, setExerciseSet] = useState<ExerciseSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, ExerciseState>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showVerifiedAnswer, setShowVerifiedAnswer] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setExerciseSet(null);
    setSelectedId(null);
    setShowVerifiedAnswer(false);
    void Promise.all([
      adapter.fetchResourceBytes(resource),
      exerciseRepository.listByResource(resource.id).catch(() => []),
    ])
      .then(([bytes, savedStates]) => {
        if (cancelled) return;
        const text = new TextDecoder().decode(bytes);
        let parsed: ExerciseSet;
        if (/<[a-z][\s\S]*>/i.test(text)) {
          parsed = parseExercisesFromHtml(text, resource.id);
        } else {
          parsed = parseExercisesFromDocument(document, resource.id, "host-dom");
        }
        if (parsed.questions.length === 0) {
          const hostParsed = parseExercisesFromDocument(document, resource.id, "host-dom");
          if (hostParsed.questions.length > 0) parsed = hostParsed;
        }
        const stateMap: Record<string, ExerciseState> = {};
        for (const question of parsed.questions) {
          const base = defaultState(question, resource.id);
          stateMap[base.exerciseId] = base;
        }
        for (const saved of savedStates) {
          if (stateMap[saved.exerciseId]) stateMap[saved.exerciseId] = saved;
        }
        const firstUnfinished =
          parsed.questions.find(
            (question) => !stateMap[stateKey(resource.id, question.id)]?.completed,
          ) ?? parsed.questions[0];
        setExerciseSet(parsed);
        setStates(stateMap);
        setSelectedId(firstUnfinished?.id ?? null);
        if (firstUnfinished) {
          const key = stateKey(resource.id, firstUnfinished.id);
          const next = { ...stateMap[key]!, viewed: true, updatedAt: new Date().toISOString() };
          stateMap[key] = next;
          setStates({ ...stateMap });
          void exerciseRepository.put(next);
        }
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "作业读取失败");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resource, adapter]);

  const selected = useMemo(
    () => exerciseSet?.questions.find((question) => question.id === selectedId) ?? null,
    [exerciseSet, selectedId],
  );
  const selectedState = selected ? states[stateKey(resource.id, selected.id)] : null;
  const progress = useMemo(() => {
    const questions = exerciseSet?.questions ?? [];
    const completed = questions.filter(
      (question) => states[stateKey(resource.id, question.id)]?.completed,
    ).length;
    return { completed, total: questions.length };
  }, [exerciseSet, states]);

  const updateState = (patch: Partial<ExerciseState>) => {
    if (!selected) return;
    const key = stateKey(resource.id, selected.id);
    const previous = states[key] ?? defaultState(selected, resource.id);
    const next = { ...previous, ...patch, updatedAt: new Date().toISOString() };
    setStates((items) => ({ ...items, [key]: next }));
    void exerciseRepository.put(next);
  };

  const selectQuestion = (question: ExerciseQuestion) => {
    setSelectedId(question.id);
    setShowVerifiedAnswer(false);
    const key = stateKey(resource.id, question.id);
    const previous = states[key] ?? defaultState(question, resource.id);
    if (!previous.viewed) {
      const next = { ...previous, viewed: true, updatedAt: new Date().toISOString() };
      setStates((items) => ({ ...items, [key]: next }));
      void exerciseRepository.put(next);
    }
  };

  if (loading) {
    return (
      <div class="pg-reader-loading">
        <div class="pg-progress">
          <span style={{ width: "52%" }} />
        </div>
        <p>正在解析作业题目…</p>
      </div>
    );
  }

  if (error || !exerciseSet) {
    return (
      <div class="pg-empty">
        <div class="pg-empty-card">
          <h2>无法读取作业</h2>
          <p>{error ?? "没有识别到题目结构"}</p>
          <button
            class="pg-button pg-button-primary"
            type="button"
            onClick={() => void onDownload(resource)}
          >
            <DownloadIcon /> 下载原始作业
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="pg-exercise-reader">
      <header class="pg-exercise-header">
        <div>
          <h2>{exerciseSet.title}</h2>
          <span class="pg-muted">
            已完成 {progress.completed} / {progress.total}
          </span>
        </div>
        <div class="pg-progress" style={{ width: "160px" }}>
          <span
            style={{
              width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%`,
            }}
          />
        </div>
        <button class="pg-button" type="button" onClick={() => void onDownload(resource)}>
          <DownloadIcon /> 下载
        </button>
      </header>
      {exerciseSet.warnings.length ? (
        <div class="pg-compat-warning">{exerciseSet.warnings.join(" ")}</div>
      ) : null}
      <div class="pg-exercise-body">
        <nav class="pg-exercise-nav" aria-label="题目导航">
          {exerciseSet.questions.map((question) => {
            const state = states[stateKey(resource.id, question.id)];
            return (
              <button
                key={question.id}
                type="button"
                class={`pg-question-number${question.id === selectedId ? " selected" : ""}`}
                data-status={
                  state?.completed
                    ? "completed"
                    : state?.needsReview
                      ? "review"
                      : state?.viewed
                        ? "viewed"
                        : "new"
                }
                onClick={() => selectQuestion(question)}
                aria-label={`第 ${question.number} 题`}
              >
                {question.number}
                {state?.completed ? <CheckIcon /> : null}
              </button>
            );
          })}
        </nav>
        <main class="pg-exercise-content">
          {selected && selectedState ? (
            <>
              <article class="pg-question-card">
                <div class="pg-question-meta">
                  <span class="pg-badge">第 {selected.number} 题</span>
                  {selectedState.needsReview ? <span class="pg-badge">待复核</span> : null}
                  {selectedState.completed ? <span class="pg-badge">已完成</span> : null}
                </div>
                <h3>{selected.stem}</h3>
                {selected.options.length ? (
                  <div class="pg-question-options">
                    {selected.options.map((option) => (
                      <label
                        key={option.id}
                        class={`pg-option${selectedState.userAnswer === option.label ? " selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name={`question-${selected.id}`}
                          checked={selectedState.userAnswer === option.label}
                          onChange={() => updateState({ userAnswer: option.label })}
                        />
                        <span>{option.label}</span>
                        <span>{option.text}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    class="pg-textarea"
                    value={selectedState.userAnswer}
                    onInput={(event) =>
                      updateState({
                        userAnswer: (event.currentTarget as HTMLTextAreaElement).value,
                      })
                    }
                    placeholder="在这里写下你的作答…"
                    aria-label="作答"
                  />
                )}
                <div class="pg-question-actions">
                  <button
                    class="pg-button"
                    type="button"
                    onClick={() => updateState({ viewed: true })}
                  >
                    已查看
                  </button>
                  <button
                    class="pg-button"
                    type="button"
                    onClick={() =>
                      updateState({ completed: !selectedState.completed, needsReview: false })
                    }
                  >
                    {selectedState.completed ? "取消完成" : "标记完成"}
                  </button>
                  <button
                    class="pg-button"
                    type="button"
                    onClick={() => updateState({ needsReview: !selectedState.needsReview })}
                  >
                    {selectedState.needsReview ? "取消复核" : "加入复核"}
                  </button>
                  <button
                    class="pg-button"
                    type="button"
                    onClick={() => onCreateReview(selected, null)}
                  >
                    保存为复习
                  </button>
                </div>
              </article>

              <section class="pg-verified-answer" aria-label="平台参考答案">
                <div class="pg-section-header">
                  <span class="pg-section-title">参考答案</span>
                  <span class="pg-badge">
                    {selected.verifiedSource === "platform-verified" ? "平台已验证" : "未验证"}
                  </span>
                  {selected.verifiedAnswer ? (
                    <button
                      class="pg-button"
                      type="button"
                      onClick={() => setShowVerifiedAnswer((value) => !value)}
                    >
                      {showVerifiedAnswer ? "收起" : "显示"}
                    </button>
                  ) : null}
                </div>
                {selected.verifiedAnswer ? (
                  showVerifiedAnswer ? (
                    <div class="pg-verified-answer-text">{selected.verifiedAnswer}</div>
                  ) : (
                    <p class="pg-muted">先独立尝试，再查看平台提供的参考答案。</p>
                  )
                ) : (
                  <p class="pg-muted">
                    平台没有提供可验证参考答案；可使用下方 AI 学习辅助，但 AI
                    结果不会被标记为平台已验证。
                  </p>
                )}
                {selected.explanation ? <p class="pg-muted">{selected.explanation}</p> : null}
              </section>

              <AiStudyPanel
                question={selected}
                configs={providerConfigs}
                onOpenSettings={onOpenAiSettings}
                onNotify={onNotify}
                onCreateReview={onCreateReview}
              />
            </>
          ) : (
            <p class="pg-muted">请选择一道题目。</p>
          )}
        </main>
      </div>
    </div>
  );
}
