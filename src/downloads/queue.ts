export type DownloadStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface DownloadTask {
  id: string;
  name: string;
  url: string;
  kind: "file";
  status: DownloadStatus;
  loaded: number;
  total: number | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DownloadQueueOptions {
  concurrency?: number;
  maxMemoryBytes?: number;
  fetchImpl?: typeof fetch;
  onCompleted?: (task: DownloadTask, blob: Blob) => void;
}

type Listener = (tasks: DownloadTask[]) => void;

const MAX_DEFAULT_BYTES = 512 * 1024 * 1024;

export class DownloadQueue {
  private readonly concurrency: number;
  private readonly maxMemoryBytes: number;
  private readonly fetchImpl: typeof fetch;
  private readonly onCompleted?: (task: DownloadTask, blob: Blob) => void;
  private readonly tasks = new Map<string, DownloadTask>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly listeners = new Set<Listener>();
  private running = 0;

  constructor(options: DownloadQueueOptions = {}) {
    this.concurrency = Math.max(1, options.concurrency ?? 2);
    this.maxMemoryBytes = options.maxMemoryBytes ?? MAX_DEFAULT_BYTES;
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    this.onCompleted = options.onCompleted;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.list());
    return () => this.listeners.delete(listener);
  }

  list(): DownloadTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  add(input: { name: string; url: string }): DownloadTask {
    const now = new Date().toISOString();
    const task: DownloadTask = {
      id: crypto.randomUUID(),
      name: input.name,
      url: input.url,
      kind: "file",
      status: "queued",
      loaded: 0,
      total: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(task.id, task);
    this.emit();
    void this.pump();
    return task;
  }

  cancel(id: string): void {
    const task = this.tasks.get(id);
    if (!task) return;
    if (task.status === "queued") {
      this.update(id, { status: "cancelled", updatedAt: new Date().toISOString() });
    } else if (task.status === "running") {
      this.controllers.get(id)?.abort();
    }
  }

  retry(id: string): void {
    const task = this.tasks.get(id);
    if (!task || !["failed", "cancelled"].includes(task.status)) return;
    this.update(id, {
      status: "queued",
      loaded: 0,
      total: null,
      error: null,
      updatedAt: new Date().toISOString(),
    });
    void this.pump();
  }

  private update(id: string, patch: Partial<DownloadTask>): void {
    const task = this.tasks.get(id);
    if (!task) return;
    Object.assign(task, patch);
    this.tasks.set(id, task);
    this.emit();
  }

  private emit(): void {
    const tasks = this.list();
    for (const listener of this.listeners) listener(tasks);
  }

  private async pump(): Promise<void> {
    while (this.running < this.concurrency) {
      const next = this.list().find((task) => task.status === "queued");
      if (!next) return;
      this.running += 1;
      void this.run(next).finally(() => {
        this.running -= 1;
        void this.pump();
      });
    }
  }

  private async run(task: DownloadTask): Promise<void> {
    const controller = new AbortController();
    this.controllers.set(task.id, controller);
    this.update(task.id, { status: "running", updatedAt: new Date().toISOString() });
    try {
      const response = await this.fetchImpl(task.url, {
        credentials: "omit",
        redirect: "follow",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const totalHeader = Number(response.headers.get("content-length") ?? "0");
      const total = totalHeader > 0 ? totalHeader : null;
      if (total && total > this.maxMemoryBytes) {
        throw new Error("文件超过浏览器内存下载上限，请使用平台原始下载入口");
      }
      if (!response.body) throw new Error("浏览器没有提供可读取的响应流");

      const reader = response.body.getReader();
      const chunks: BlobPart[] = [];
      let loaded = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        loaded += value.byteLength;
        if (loaded > this.maxMemoryBytes) {
          await reader.cancel();
          throw new Error("文件超过浏览器内存下载上限，请使用平台原始下载入口");
        }
        chunks.push(value.slice().buffer as ArrayBuffer);
        this.update(task.id, {
          loaded,
          total,
          updatedAt: new Date().toISOString(),
        });
      }
      const blob = new Blob(chunks, {
        type: response.headers.get("content-type") ?? "application/octet-stream",
      });
      this.update(task.id, {
        status: "completed",
        loaded: blob.size,
        total: blob.size,
        updatedAt: new Date().toISOString(),
      });
      this.onCompleted?.({ ...task, status: "completed" }, blob);
    } catch (error) {
      if (controller.signal.aborted) {
        this.update(task.id, {
          status: "cancelled",
          updatedAt: new Date().toISOString(),
        });
      } else {
        this.update(task.id, {
          status: "failed",
          error: error instanceof Error ? error.message : "下载失败",
          updatedAt: new Date().toISOString(),
        });
      }
    } finally {
      this.controllers.delete(task.id);
    }
  }
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
