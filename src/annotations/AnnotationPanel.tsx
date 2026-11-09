import { useEffect, useRef, useState } from "preact/hooks";
import type { Annotation } from "./types";

interface AnnotationPanelProps {
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  onSelect: (annotation: Annotation) => void;
  onUpdateNote: (annotation: Annotation, note: string) => void;
  onDelete: (annotation: Annotation) => void;
  onCreateReview: (annotation: Annotation) => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
}

export function AnnotationPanel({
  annotations,
  selectedAnnotationId,
  onSelect,
  onUpdateNote,
  onDelete,
  onCreateReview,
  onExport,
  onImportFile,
}: AnnotationPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selected = annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null;
  const [note, setNote] = useState(selected?.note ?? "");

  useEffect(() => {
    setNote(selected?.note ?? "");
  }, [selected?.id, selected?.note]);

  return (
    <section class="pg-annotation-panel" aria-label="标注">
      <div class="pg-section-header" style={{ padding: "0 0 8px" }}>
        <span class="pg-section-title">标注</span>
        <span class="pg-spacer" />
        <span class="pg-badge">{annotations.length}</span>
      </div>
      <div class="pg-annotation-actions">
        <button
          class="pg-button"
          type="button"
          onClick={onExport}
          disabled={annotations.length === 0}
        >
          导出
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
            if (file) onImportFile(file);
            (event.currentTarget as HTMLInputElement).value = "";
          }}
        />
      </div>
      <div class="pg-annotation-list" role="list">
        {annotations.length === 0 ? (
          <p class="pg-muted">在 PDF 中选择文字即可划线。</p>
        ) : (
          annotations
            .slice()
            .sort((a, b) => a.page - b.page || a.createdAt.localeCompare(b.createdAt))
            .map((annotation) => (
              <button
                key={annotation.id}
                type="button"
                role="listitem"
                class={`pg-annotation-item${annotation.id === selectedAnnotationId ? " selected" : ""}`}
                onClick={() => onSelect(annotation)}
              >
                <div class="pg-annotation-meta">
                  <span class={`pg-color-bar pg-color-${annotation.color}`} />
                  <span>第 {annotation.page} 页</span>
                  {annotation.needsRelocation ? <span class="pg-badge">需重新定位</span> : null}
                </div>
                <div class="pg-annotation-quote">{annotation.text}</div>
                {annotation.note ? (
                  <div class="pg-annotation-note-preview">{annotation.note}</div>
                ) : null}
              </button>
            ))
        )}
      </div>
      {selected ? (
        <div class="pg-annotation-editor">
          <label class="pg-section-title" for={`annotation-note-${selected.id}`}>
            当前标注注释
          </label>
          <textarea
            id={`annotation-note-${selected.id}`}
            class="pg-textarea"
            value={note}
            onInput={(event) => setNote((event.currentTarget as HTMLTextAreaElement).value)}
            placeholder="写一句简短注释…"
          />
          <div class="pg-annotation-editor-actions">
            <button
              class="pg-button pg-button-primary"
              type="button"
              onClick={() => onUpdateNote(selected, note)}
            >
              保存
            </button>
            <button class="pg-button" type="button" onClick={() => onSelect(selected)}>
              定位
            </button>
            <button class="pg-button" type="button" onClick={() => onCreateReview(selected)}>
              保存为复习
            </button>
            <button
              class="pg-button pg-button-danger"
              type="button"
              onClick={() => onDelete(selected)}
            >
              删除
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
