import { useState } from "preact/hooks";
import type { ModelInfo, ProviderConfig } from "./types";
import { listModels } from "./providers/registry";
import { CloseIcon } from "../ui/icons";

interface AiSettingsModalProps {
  configs: ProviderConfig[];
  onClose: () => void;
  onSave: (configs: ProviderConfig[]) => void | Promise<void>;
  onNotify: (message: string, tone?: "info" | "error") => void;
}

export function AiSettingsModal({ configs, onClose, onSave, onNotify }: AiSettingsModalProps) {
  const [draft, setDraft] = useState(configs.map((config) => ({ ...config })));
  const [models, setModels] = useState<Record<string, ModelInfo[]>>({});
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const update = (id: string, patch: Partial<ProviderConfig>) => {
    setDraft((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const discover = async (config: ProviderConfig) => {
    if (!config.apiKey) {
      onNotify("请先填写该 Provider 的 API Key", "error");
      return;
    }
    if (!config.baseUrl) {
      onNotify("请填写 Provider Base URL", "error");
      return;
    }
    setLoadingProvider(config.id);
    try {
      const discovered = await listModels(config, config.apiKey, fetch.bind(globalThis));
      setModels((previous) => ({ ...previous, [config.id]: discovered }));
      const free = discovered.filter((model) => model.free === true);
      onNotify(`已发现 ${discovered.length} 个模型，其中 ${free.length} 个明确免费`, "info");
    } catch (reason) {
      onNotify(reason instanceof Error ? reason.message : "模型发现失败", "error");
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <div class="pg-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        class="pg-modal"
        role="dialog"
        aria-modal="true"
        aria-label="AI Provider 设置"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header class="pg-modal-header">
          <div>
            <h2>AI Provider 设置</h2>
            <p>API Key 只保存在本机 IndexedDB，不会进入普通数据导出。</p>
          </div>
          <button class="pg-icon-button" type="button" aria-label="关闭设置" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <div class="pg-modal-body">
          {draft.map((config) => {
            const discovered = models[config.id] ?? [];
            return (
              <article class="pg-provider-card" key={config.id}>
                <div class="pg-provider-head">
                  <div>
                    <strong>{config.label}</strong>
                    <span class="pg-badge">{config.kind}</span>
                  </div>
                  <label class="pg-checkbox">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(event) =>
                        update(config.id, {
                          enabled: (event.currentTarget as HTMLInputElement).checked,
                        })
                      }
                    />
                    启用
                  </label>
                </div>
                <div class="pg-provider-grid">
                  <label>
                    <span>Base URL</span>
                    <input
                      class="pg-input"
                      value={config.baseUrl}
                      onInput={(event) =>
                        update(config.id, {
                          baseUrl: (event.currentTarget as HTMLInputElement).value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>API Key</span>
                    <input
                      class="pg-input"
                      type="password"
                      autocomplete="off"
                      value={config.apiKey ?? ""}
                      onInput={(event) =>
                        update(config.id, {
                          apiKey: (event.currentTarget as HTMLInputElement).value,
                        })
                      }
                    />
                  </label>
                  <label class="pg-provider-model">
                    <span>模型</span>
                    <input
                      class="pg-input"
                      value={config.model}
                      onInput={(event) =>
                        update(config.id, {
                          model: (event.currentTarget as HTMLInputElement).value,
                        })
                      }
                      placeholder="可手动输入，或先发现模型"
                    />
                    {discovered.length ? (
                      <select
                        class="pg-select"
                        value=""
                        onChange={(event) =>
                          update(config.id, { model: event.currentTarget.value })
                        }
                        aria-label={`${config.label} 可用模型`}
                      >
                        <option value="">选择发现到的模型…</option>
                        {discovered.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.label} ·{" "}
                            {model.free === true
                              ? "免费"
                              : model.free === false
                                ? "付费"
                                : "价格未知"}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </label>
                </div>
                <div class="pg-provider-foot">
                  <button
                    class="pg-button"
                    type="button"
                    onClick={() => void discover(config)}
                    disabled={loadingProvider === config.id}
                  >
                    {loadingProvider === config.id ? "发现中…" : "发现模型"}
                  </button>
                  <label class="pg-checkbox">
                    <input
                      type="checkbox"
                      checked={config.allowPaid}
                      onChange={(event) =>
                        update(config.id, {
                          allowPaid: (event.currentTarget as HTMLInputElement).checked,
                        })
                      }
                    />
                    允许付费模型
                  </label>
                  <span class="pg-muted">默认阻止未能确认免费的 OpenRouter 模型。</span>
                </div>
              </article>
            );
          })}
        </div>
        <footer class="pg-modal-footer">
          <span class="pg-muted">
            只有点击“提示 / 解析 / 答案核对”并勾选本次发送同意后，才会发起外部请求。
          </span>
          <div class="pg-toolbar">
            <button class="pg-button" type="button" onClick={onClose}>
              取消
            </button>
            <button
              class="pg-button pg-button-primary"
              type="button"
              onClick={() => void onSave(draft)}
            >
              保存设置
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
