import { CloseIcon } from "../ui/icons";

export interface ReaderPreferencesValue {
  fontScale: number;
  lineHeight: number;
}

export const DEFAULT_READER_PREFERENCES: ReaderPreferencesValue = {
  fontScale: 1,
  lineHeight: 1.65,
};

interface ReaderPreferencesProps {
  value: ReaderPreferencesValue;
  onChange: (value: ReaderPreferencesValue) => void;
  onClose: () => void;
}

export function ReaderPreferences({ value, onChange, onClose }: ReaderPreferencesProps) {
  return (
    <div class="pg-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        class="pg-reader-preferences"
        role="dialog"
        aria-modal="true"
        aria-label="阅读显示设置"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header class="pg-modal-header">
          <div>
            <h2>阅读显示设置</h2>
            <p>固定版式 PDF 保留原始页面；文本重排仅用于作业、AI 解析和复习卡片。</p>
          </div>
          <button class="pg-icon-button" type="button" aria-label="关闭阅读设置" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <div class="pg-reader-preferences-body">
          <label>
            <span>文字大小 · {Math.round(value.fontScale * 100)}%</span>
            <input
              type="range"
              min={0.9}
              max={1.4}
              step={0.05}
              value={value.fontScale}
              onInput={(event) =>
                onChange({
                  ...value,
                  fontScale: Number((event.currentTarget as HTMLInputElement).value),
                })
              }
            />
          </label>
          <label>
            <span>行距 · {value.lineHeight.toFixed(2)}</span>
            <input
              type="range"
              min={1.4}
              max={2.05}
              step={0.05}
              value={value.lineHeight}
              onInput={(event) =>
                onChange({
                  ...value,
                  lineHeight: Number((event.currentTarget as HTMLInputElement).value),
                })
              }
            />
          </label>
          <p class="pg-muted">快捷键：F 切换专注阅读，R 打开复习，Esc 关闭当前面板。</p>
        </div>
        <footer class="pg-modal-footer">
          <span />
          <button class="pg-button pg-button-primary" type="button" onClick={onClose}>
            完成
          </button>
        </footer>
      </section>
    </div>
  );
}
