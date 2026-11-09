import { useEffect, useRef, useState } from "preact/hooks";
import { reviewRepository } from "../storage/repositories";
import { parseReviewImport, serializeReviewItems } from "./export";
import { dueReviews, reviewedToday, scheduleReview } from "./scheduler";
import type { ReviewItem, ReviewRating } from "./types";
import { CloseIcon, DownloadIcon } from "../ui/icons";
import { saveBlob } from "../downloads/queue";

interface ReviewWorkspaceProps {
  onClose: () => void;
  onNotify: (message: string, tone?: "info" | "error") => void;
  onOpenSource: (source: ReviewItem["source"]) => void;
}

function sourceLabel(source: ReviewItem["source"]): string {
  if (source.type === "annotation") return "来自划线/注释";
  if (source.type === "exercise") return "来自练习题";
  return "手动复习项目";
}

export function ReviewWorkspace({ onClose, onNotify, onOpenSource }: ReviewWorkspaceProps) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const all = await reviewRepository.list();
    setItems(all);
    setQueue(dueReviews(all));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const current = queue[0] ?? null;
  const todayCount = reviewedToday(items);
  const future = items
    .filter((item) => !queue.some((queued) => queued.id === item.id))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];

  const rate = async (rating: ReviewRating) => {
    if (!current) return;
    const next = scheduleReview(current, rating);
    await reviewRepository.put(next);
    setRevealed(false);
    setItems((previous) => previous.map((item) => (item.id === next.id ? next : item)));
    setQueue((previous) => previous.slice(1));
    onNotify(
      rating === "again"
        ? "将在 10 分钟后再次出现"
        : `下次复习：${new Date(next.dueAt).toLocaleDateString()}`,
      "info",
    );
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.code === "Space" && current && !revealed) {
        event.preventDefault();
        setRevealed(true);
      } else if (revealed && ["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        const ratings: ReviewRating[] = ["again", "hard", "good", "easy"];
        void rate(ratings[Number(event.key) - 1]!);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, revealed, onClose]);

  const exportAll = async () => {
    const all = await reviewRepository.list();
    saveBlob(
      new Blob([serializeReviewItems(all)], { type: "application/json" }),
      "petite-grace-review-items.json",
    );
  };

  const importFile = (file: File) => {
    void file
      .text()
      .then(async (text) => {
        const imported = parseReviewImport(text);
        await Promise.all(imported.map((item) => reviewRepository.put(item)));
        await load();
        onNotify(`已导入 ${imported.length} 条复习项目`, "info");
      })
      .catch((reason: unknown) => {
        onNotify(reason instanceof Error ? reason.message : "复习项目导入失败", "error");
      });
  };

  return (
    <section class="pg-review-overlay" aria-label="复习工作区">
      <header class="pg-review-header">
        <div>
          <h2>复习</h2>
          <span class="pg-muted">
            今日已复习 {todayCount} · 待复习 {queue.length}
          </span>
        </div>
        <div class="pg-toolbar">
          <button class="pg-button" type="button" onClick={() => void exportAll()}>
            <DownloadIcon /> 导出
          </button>
          <button class="pg-button" type="button" onClick={() => fileInputRef.current?.click()}>
            导入
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = (event.currentTarget as HTMLInputElement).files?.[0];
              if (file) importFile(file);
              (event.currentTarget as HTMLInputElement).value = "";
            }}
          />
          <button
            class="pg-icon-button"
            type="button"
            aria-label="关闭复习工作区"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <main class="pg-review-main">
        {loading ? <p class="pg-muted">正在读取复习项目…</p> : null}
        {!loading && !current ? (
          <div class="pg-review-empty">
            <h2>今天的复习完成了</h2>
            <p>
              {future
                ? `下一张卡片：${new Date(future.dueAt).toLocaleString()}`
                : "还没有复习项目。"}
            </p>
            <p class="pg-muted">可从练习题、划线或注释创建复习项目。</p>
          </div>
        ) : null}
        {current ? (
          <article class="pg-review-card">
            <div class="pg-review-card-meta">
              <span class="pg-badge">{sourceLabel(current.source)}</span>
              <span class="pg-muted">剩余 {queue.length}</span>
            </div>
            <div class="pg-review-front">{current.front}</div>
            {revealed ? <div class="pg-review-back">{current.back}</div> : null}
            {!revealed ? (
              <button
                class="pg-button pg-button-primary pg-review-reveal"
                type="button"
                onClick={() => setRevealed(true)}
              >
                查看答案 <span class="pg-kbd">Space</span>
              </button>
            ) : (
              <div class="pg-review-ratings" aria-label="复习反馈">
                <button class="pg-button" type="button" onClick={() => void rate("again")}>
                  重来 <span class="pg-kbd">1</span>
                </button>
                <button class="pg-button" type="button" onClick={() => void rate("hard")}>
                  困难 <span class="pg-kbd">2</span>
                </button>
                <button
                  class="pg-button pg-button-primary"
                  type="button"
                  onClick={() => void rate("good")}
                >
                  良好 <span class="pg-kbd">3</span>
                </button>
                <button class="pg-button" type="button" onClick={() => void rate("easy")}>
                  简单 <span class="pg-kbd">4</span>
                </button>
              </div>
            )}
            {current.source.type !== "manual" ? (
              <button class="pg-button" type="button" onClick={() => onOpenSource(current.source)}>
                回到原文来源
              </button>
            ) : null}
          </article>
        ) : null}
      </main>
    </section>
  );
}
