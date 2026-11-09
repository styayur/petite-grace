import { describe, expect, it, vi } from "vitest";
import { DownloadQueue } from "../../src/downloads/queue";

function streamResponse(chunks: string[], total?: number): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
  return new Response(body, {
    headers: total ? { "content-length": String(total) } : undefined,
  });
}

describe("DownloadQueue", () => {
  it("tracks progress and completes a download", async () => {
    const onCompleted = vi.fn();
    const queue = new DownloadQueue({
      fetchImpl: (async () => streamResponse(["hello", " world"], 11)) as typeof fetch,
      onCompleted,
    });
    const task = queue.add({ name: "note.txt", url: "https://course.ai-augmented.com/file" });
    await vi.waitFor(() => expect(queue.list()[0]?.status).toBe("completed"));
    expect(queue.list()[0]?.loaded).toBe(11);
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(task.id).toBeTruthy();
  });

  it("cancels a queued task while another task is running", async () => {
    let release: ((response: Response) => void) | undefined;
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          release = resolve;
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    const queue = new DownloadQueue({ concurrency: 1, fetchImpl: fetchImpl as typeof fetch });
    const first = queue.add({ name: "first", url: "https://example.com/1" });
    const second = queue.add({ name: "second", url: "https://example.com/2" });
    queue.cancel(second.id);
    expect(queue.list().find((task) => task.id === second.id)?.status).toBe("cancelled");
    queue.cancel(first.id);
    release?.(streamResponse(["x"], 1));
    await vi.waitFor(() =>
      expect(queue.list().find((task) => task.id === first.id)?.status).toBe("cancelled"),
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
