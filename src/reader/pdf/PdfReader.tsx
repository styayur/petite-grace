import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { CourseAdapter, ResourceRecord } from "../../platform/xiaoya/types";
import { readingRepository } from "../../storage/repositories";
import type { PdfLayout, ReadingState, ZoomMode } from "../types";
import { loadPdfJs } from "./pdfjs";
import { DownloadIcon, SearchIcon } from "../../ui/icons";

const DEFAULT_PAGE_WIDTH = 612;
const DEFAULT_PAGE_HEIGHT = 792;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const RENDER_MARGIN = "1200px";

interface PdfReaderProps {
  resource: ResourceRecord;
  adapter: CourseAdapter;
  onDownload: (resource: ResourceRecord) => void | Promise<void>;
  onNotify: (message: string, tone?: "info" | "error") => void;
}

interface SearchResult {
  page: number;
  snippet: string;
  index: number;
}

function documentId(resource: ResourceRecord): string {
  return `${resource.courseId}:${resource.id}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function PdfPage({
  pdfDocument,
  pageNumber,
  scale,
  aspect,
  scrollRoot,
  onMeasured,
}: {
  pdfDocument: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  aspect: number;
  scrollRoot: HTMLDivElement | null;
  onMeasured: (page: number, aspect: number) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const width = DEFAULT_PAGE_WIDTH * scale;
  const height = width / aspect;

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element || !scrollRoot) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setVisible(entry.isIntersecting);
      },
      { root: scrollRoot, rootMargin: RENDER_MARGIN, threshold: 0.01 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [scrollRoot]);

  useEffect(() => {
    if (!visible) {
      setRendered(false);
      return;
    }
    let cancelled = false;
    let page: PDFPageProxy | null = null;
    let textLayer: { cancel: () => void } | null = null;
    const canvas = canvasRef.current;
    const textLayerElement = textLayerRef.current;
    if (!canvas || !textLayerElement) return;

    void (async () => {
      try {
        const pdfjs = await loadPdfJs();
        page = await pdfDocument.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        onMeasured(pageNumber, viewport.width / viewport.height);
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("无法创建 PDF 画布");
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        await page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        }).promise;
        if (cancelled) return;

        const textContent = await page.getTextContent();
        if (cancelled) return;
        textLayerElement.replaceChildren();
        textLayerElement.style.width = `${viewport.width}px`;
        textLayerElement.style.height = `${viewport.height}px`;
        const layer = new pdfjs.TextLayer({
          textContentSource: textContent,
          container: textLayerElement,
          viewport,
        });
        textLayer = layer;
        await layer.render();
        if (!cancelled) setRendered(true);
      } catch (reason) {
        if (!cancelled) {
          textLayer?.cancel();
          setRenderError(reason instanceof Error ? reason.message : "页面渲染失败");
        }
      }
    })();

    return () => {
      cancelled = true;
      textLayer?.cancel();
    };
  }, [visible, pdfDocument, pageNumber, scale, onMeasured]);

  return (
    <div
      ref={wrapperRef}
      class="pg-pdf-page"
      data-page={pageNumber}
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      <canvas ref={canvasRef} aria-label={`第 ${pageNumber} 页`} />
      <div ref={textLayerRef} class="pg-text-layer" />
      {!rendered && !renderError ? <div class="pg-page-loading">第 {pageNumber} 页</div> : null}
      {renderError ? <div class="pg-page-error">{renderError}</div> : null}
    </div>
  );
}

export function PdfReader({ resource, adapter, onDownload, onNotify }: PdfReaderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [aspect, setAspect] = useState(DEFAULT_PAGE_WIDTH / DEFAULT_PAGE_HEIGHT);
  const [layout, setLayout] = useState<PdfLayout>("single");
  const [zoomMode, setZoomMode] = useState<ZoomMode>("fit-width");
  const [customScale, setCustomScale] = useState(1);
  const [containerWidth, setContainerWidth] = useState(900);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [restored, setRestored] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const suppressScrollTrackingUntilRef = useRef(0);

  const docId = documentId(resource);
  const scale = useMemo(() => {
    if (zoomMode === "custom") return customScale;
    const available = Math.max(360, containerWidth - (layout === "double" ? 58 : 42));
    const widthScale =
      available / (layout === "double" ? DEFAULT_PAGE_WIDTH * 2 : DEFAULT_PAGE_WIDTH);
    if (zoomMode === "fit-page") {
      const viewportHeight = scrollRef.current?.clientHeight ?? window.innerHeight - 150;
      return clamp(
        Math.min(widthScale, viewportHeight / DEFAULT_PAGE_HEIGHT),
        MIN_SCALE,
        MAX_SCALE,
      );
    }
    return clamp(widthScale, MIN_SCALE, MAX_SCALE);
  }, [zoomMode, customScale, containerWidth, layout]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next) setContainerWidth(next);
    });
    observer.observe(element);
    setContainerWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadedDocument: PDFDocumentProxy | null = null;
    setLoading(true);
    setError(null);
    setPdfDocument(null);
    setRestored(false);
    void Promise.all([
      adapter.fetchResourceBytes(resource),
      readingRepository.get(docId).catch(() => undefined),
    ])
      .then(async ([bytes, saved]) => {
        if (cancelled) return;
        const pdfjs = await loadPdfJs();
        const task = pdfjs.getDocument({
          data: new Uint8Array(bytes),
          useSystemFonts: true,
        });
        loadedDocument = await task.promise;
        if (cancelled) {
          await loadedDocument.loadingTask.destroy();
          return;
        }
        setPdfDocument(loadedDocument);
        setNumPages(loadedDocument.numPages);
        const firstPage = await loadedDocument.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1 });
        setAspect(viewport.width / viewport.height);
        if (saved) {
          suppressScrollTrackingUntilRef.current = Date.now() + 2000;
          setLayout(saved.layout);
          setZoomMode(saved.zoomMode);
          setCustomScale(saved.scale);
          setCurrentPage(clamp(saved.page, 1, loadedDocument.numPages));
        }
        setLoading(false);
        window.setTimeout(() => setRestored(true), 120);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "PDF 加载失败");
        setLoading(false);
      });
    return () => {
      cancelled = true;
      if (loadedDocument) void loadedDocument.loadingTask.destroy();
    };
  }, [resource, adapter, docId]);

  const saveState = (partial: Partial<ReadingState> = {}) => {
    if (!pdfDocument) return;
    const state: ReadingState = {
      documentId: docId,
      page: currentPage,
      relativeScroll: 0,
      scale,
      layout,
      zoomMode,
      updatedAt: new Date().toISOString(),
      ...partial,
    };
    void readingRepository.put(state).catch(() => undefined);
  };

  useEffect(() => {
    if (!restored || !pdfDocument || !scrollRef.current) return;
    const restore = () => {
      const target = scrollRef.current?.querySelector<HTMLElement>(`[data-page="${currentPage}"]`);
      if (target && scrollRef.current)
        scrollRef.current.scrollTop = Math.max(0, target.offsetTop - 12);
    };
    const frame = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(frame);
  }, [restored, pdfDocument]);

  useEffect(() => {
    if (!restored || !pdfDocument) return;
    saveState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, zoomMode, scale, pdfDocument, restored]);

  const handleScroll = () => {
    const root = scrollRef.current;
    if (!root || !pdfDocument || !restored || Date.now() < suppressScrollTrackingUntilRef.current)
      return;
    const pages = Array.from(root.querySelectorAll<HTMLElement>(".pg-pdf-page"));
    let page = 1;
    let best = Number.POSITIVE_INFINITY;
    for (const element of pages) {
      const delta = Math.abs(element.offsetTop - root.scrollTop);
      if (delta < best) {
        best = delta;
        page = Number(element.dataset.page ?? 1);
      }
    }
    if (page !== currentPage) setCurrentPage(page);
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => saveState({ page }), 450);
  };

  const jumpToPage = (page: number) => {
    if (!pdfDocument || !scrollRef.current) return;
    const target = clamp(Math.round(page), 1, pdfDocument.numPages);
    setCurrentPage(target);
    const element = scrollRef.current.querySelector<HTMLElement>(`[data-page="${target}"]`);
    if (element)
      scrollRef.current.scrollTo({ top: Math.max(0, element.offsetTop - 12), behavior: "smooth" });
  };

  const runSearch = async () => {
    const query = searchQuery.trim().toLowerCase();
    if (!pdfDocument || !query) return;
    setSearching(true);
    setSearchOpen(true);
    const results: SearchResult[] = [];
    try {
      for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
        const page = await pdfDocument.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ");
        let index = text.toLowerCase().indexOf(query);
        while (index >= 0 && results.length < 100) {
          const start = Math.max(0, index - 32);
          results.push({
            page: pageNumber,
            snippet: text.slice(start, Math.min(text.length, index + query.length + 48)),
            index,
          });
          index = text.toLowerCase().indexOf(query, index + query.length);
        }
      }
      setSearchResults(results);
      if (results.length) jumpToPage(results[0]!.page);
      else onNotify("没有找到匹配文本", "info");
    } catch (reason) {
      onNotify(reason instanceof Error ? reason.message : "搜索失败", "error");
    } finally {
      setSearching(false);
    }
  };

  if (loading) {
    return (
      <div class="pg-reader-loading">
        <div class="pg-progress">
          <span style={{ width: "55%" }} />
        </div>
        <p>正在加载 PDF 文档…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div class="pg-empty">
        <div class="pg-empty-card">
          <h2>PDF 加载失败</h2>
          <p>{error}</p>
          <button
            class="pg-button pg-button-primary"
            type="button"
            onClick={() => void onDownload(resource)}
          >
            <DownloadIcon /> 下载原始文件
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="pg-pdf-reader">
      <div class="pg-reader-toolbar" role="toolbar" aria-label="PDF 阅读工具栏">
        <button
          class="pg-button"
          type="button"
          onClick={() => jumpToPage(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          上一页
        </button>
        <label class="pg-page-jump">
          <input
            class="pg-input"
            type="number"
            min={1}
            max={numPages}
            value={currentPage}
            onInput={(event) =>
              setCurrentPage(Number((event.currentTarget as HTMLInputElement).value))
            }
            onChange={(event) =>
              jumpToPage(Number((event.currentTarget as HTMLInputElement).value))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                jumpToPage(Number((event.currentTarget as HTMLInputElement).value));
              }
            }}
            onBlur={(event) => jumpToPage(Number((event.currentTarget as HTMLInputElement).value))}
            aria-label="跳转页码"
          />
          <span>/ {numPages}</span>
        </label>
        <button
          class="pg-button"
          type="button"
          onClick={() => jumpToPage(currentPage + 1)}
          disabled={currentPage >= numPages}
        >
          下一页
        </button>
        <select
          class="pg-select"
          value={layout}
          onChange={(event) =>
            setLayout((event.currentTarget as HTMLSelectElement).value as PdfLayout)
          }
          aria-label="PDF 页面布局"
        >
          <option value="single">单列连续</option>
          <option value="double">双列连续</option>
        </select>
        <select
          class="pg-select"
          value={zoomMode}
          onChange={(event) =>
            setZoomMode((event.currentTarget as HTMLSelectElement).value as ZoomMode)
          }
          aria-label="PDF 缩放模式"
        >
          <option value="fit-width">适应宽度</option>
          <option value="fit-page">适应页面</option>
          <option value="custom">自定义</option>
        </select>
        {zoomMode === "custom" ? (
          <input
            class="pg-input pg-scale-input"
            type="range"
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.05}
            value={customScale}
            onInput={(event) =>
              setCustomScale(Number((event.currentTarget as HTMLInputElement).value))
            }
            aria-label="PDF 缩放比例"
          />
        ) : null}
        <span class="pg-spacer" />
        <div class="pg-search-box">
          <input
            class="pg-input"
            value={searchQuery}
            onInput={(event) => setSearchQuery((event.currentTarget as HTMLInputElement).value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void runSearch();
            }}
            placeholder="搜索全文"
            aria-label="搜索 PDF 全文"
          />
          <button
            class="pg-icon-button"
            type="button"
            onClick={() => void runSearch()}
            aria-label="执行搜索"
          >
            <SearchIcon />
          </button>
        </div>
        <button class="pg-button" type="button" onClick={() => void onDownload(resource)}>
          <DownloadIcon /> 下载
        </button>
      </div>
      <div className="pg-search-results" hidden={!searchOpen}>
        <div class="pg-search-results-head">
          <strong>{searching ? "正在搜索…" : `${searchResults.length} 个结果`}</strong>
          <button
            class="pg-icon-button"
            type="button"
            onClick={() => setSearchOpen(false)}
            aria-label="关闭搜索结果"
          >
            ×
          </button>
        </div>
        <div class="pg-search-results-list">
          {searchResults.map((result) => (
            <button
              class="pg-search-result"
              type="button"
              key={`${result.page}-${result.index}`}
              onClick={() => jumpToPage(result.page)}
            >
              <span class="pg-badge">第 {result.page} 页</span>
              <span>{result.snippet}</span>
            </button>
          ))}
        </div>
      </div>
      <div
        ref={scrollRef}
        class="pg-pdf-scroll"
        data-layout={layout}
        onScroll={handleScroll}
        tabIndex={0}
      >
        <div class="pg-pdf-grid">
          {pdfDocument
            ? Array.from({ length: numPages }, (_, index) => (
                <PdfPage
                  key={index + 1}
                  pdfDocument={pdfDocument}
                  pageNumber={index + 1}
                  scale={scale}
                  aspect={aspect}
                  scrollRoot={scrollRef.current}
                  onMeasured={() => undefined}
                />
              ))
            : null}
        </div>
      </div>
    </div>
  );
}
