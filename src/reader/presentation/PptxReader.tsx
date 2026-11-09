import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { CourseAdapter, ResourceRecord } from "../../platform/xiaoya/types";
import { readingRepository } from "../../storage/repositories";
import type { PdfLayout, ReadingState, ZoomMode } from "../types";
import {
  parsePptx,
  releasePptxDocument,
  type PptxDocument,
  type PptxElement,
  type PptxSlide,
} from "./pptx";
import { DownloadIcon } from "../../ui/icons";

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;

interface PptxReaderProps {
  resource: ResourceRecord;
  adapter: CourseAdapter;
  onDownload: (resource: ResourceRecord) => void | Promise<void>;
  onNotify: (message: string, tone?: "info" | "error") => void;
}

function documentId(resource: ResourceRecord): string {
  return `${resource.courseId}:${resource.id}:pptx`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function SlideElement({ element, scale }: { element: PptxElement; scale: number }) {
  const style = {
    left: `${element.x * scale}px`,
    top: `${element.y * scale}px`,
    width: `${element.width * scale}px`,
    height: `${element.height * scale}px`,
  };
  if (element.kind === "image") {
    return (
      <img
        class="pg-slide-image"
        src={element.src}
        alt={element.alt}
        style={{ ...style, objectFit: "contain" }}
      />
    );
  }
  return (
    <div
      class="pg-slide-text"
      style={{
        ...style,
        fontSize: `${element.fontSize * scale}px`,
        color: element.color,
        fontWeight: element.bold ? 700 : 400,
        textAlign: element.align,
        alignItems: element.align === "center" ? "center" : "flex-start",
      }}
    >
      {element.text}
    </div>
  );
}

function SlideView({ slide, scale }: { slide: PptxSlide; scale: number }) {
  return (
    <div
      class="pg-pptx-slide"
      data-slide={slide.number}
      style={{ width: `${slide.width * scale}px`, height: `${slide.height * scale}px` }}
    >
      <div
        class="pg-pptx-slide-content"
        style={{ width: `${slide.width * scale}px`, height: `${slide.height * scale}px` }}
      >
        {slide.elements.map((element, index) => (
          <SlideElement key={`${slide.number}-${index}`} element={element} scale={scale} />
        ))}
      </div>
      <div class="pg-slide-number">第 {slide.number} 页</div>
    </div>
  );
}

export function PptxReader({ resource, adapter, onDownload, onNotify }: PptxReaderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [documentModel, setDocumentModel] = useState<PptxDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<PdfLayout>("single");
  const [zoomMode, setZoomMode] = useState<ZoomMode>("fit-width");
  const [customScale, setCustomScale] = useState(1);
  const [containerWidth, setContainerWidth] = useState(900);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [restored, setRestored] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const suppressScrollTrackingUntilRef = useRef(0);
  const docId = documentId(resource);

  const scale = useMemo(() => {
    if (zoomMode === "custom") return customScale;
    const width = documentModel?.width ?? 960;
    const available = Math.max(320, containerWidth - (layout === "double" ? 52 : 38));
    const widthScale = available / (layout === "double" ? width * 2 : width);
    if (zoomMode === "fit-page") {
      const height = documentModel?.height ?? 540;
      const viewportHeight = scrollRef.current?.clientHeight ?? window.innerHeight - 150;
      return clamp(Math.min(widthScale, viewportHeight / height), MIN_SCALE, MAX_SCALE);
    }
    return clamp(widthScale, MIN_SCALE, MAX_SCALE);
  }, [documentModel, zoomMode, customScale, containerWidth, layout]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(element);
    setContainerWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let parsed: PptxDocument | null = null;
    setLoading(true);
    setError(null);
    setDocumentModel(null);
    setRestored(false);
    void Promise.all([
      adapter.fetchResourceBytes(resource),
      readingRepository.get(docId).catch(() => undefined),
    ])
      .then(([bytes, saved]) => {
        if (cancelled) return;
        parsed = parsePptx(bytes);
        setDocumentModel(parsed);
        if (saved) {
          suppressScrollTrackingUntilRef.current = Date.now() + 2000;
          setLayout(saved.layout);
          setZoomMode(saved.zoomMode);
          setCustomScale(saved.scale);
          setCurrentSlide(clamp(saved.page, 1, parsed.slides.length));
        }
        setLoading(false);
        window.setTimeout(() => setRestored(true), 80);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "PPTX 解析失败");
        setLoading(false);
      });
    return () => {
      cancelled = true;
      releasePptxDocument(parsed);
    };
  }, [resource, adapter, docId]);

  const saveState = (partial: Partial<ReadingState> = {}) => {
    if (!documentModel) return;
    const state: ReadingState = {
      documentId: docId,
      page: currentSlide,
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
    if (!restored || !documentModel || !scrollRef.current) return;
    const restore = () => {
      const target = scrollRef.current?.querySelector<HTMLElement>(
        `[data-slide="${currentSlide}"]`,
      );
      if (target && scrollRef.current)
        scrollRef.current.scrollTop = Math.max(0, target.offsetTop - 12);
    };
    const frame = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(frame);
  }, [restored, documentModel]);

  useEffect(() => {
    if (!restored || !documentModel) return;
    saveState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, zoomMode, scale, documentModel, restored]);

  const jumpToSlide = (slide: number) => {
    if (!documentModel || !scrollRef.current) return;
    const target = clamp(Math.round(slide), 1, documentModel.slides.length);
    setCurrentSlide(target);
    const element = scrollRef.current.querySelector<HTMLElement>(`[data-slide="${target}"]`);
    if (element)
      scrollRef.current.scrollTo({ top: Math.max(0, element.offsetTop - 12), behavior: "smooth" });
  };

  const handleScroll = () => {
    const root = scrollRef.current;
    if (!root || !documentModel || !restored || Date.now() < suppressScrollTrackingUntilRef.current)
      return;
    let slide = 1;
    let best = Number.POSITIVE_INFINITY;
    for (const element of Array.from(root.querySelectorAll<HTMLElement>(".pg-pptx-slide"))) {
      const delta = Math.abs(element.offsetTop - root.scrollTop);
      if (delta < best) {
        best = delta;
        slide = Number(element.dataset.slide ?? 1);
      }
    }
    if (slide !== currentSlide) setCurrentSlide(slide);
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => saveState({ page: slide }), 450);
  };

  if (loading) {
    return (
      <div class="pg-reader-loading">
        <div class="pg-progress">
          <span style={{ width: "55%" }} />
        </div>
        <p>正在解析 PPTX 幻灯片…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div class="pg-empty">
        <div class="pg-empty-card">
          <h2>PPTX 预览失败</h2>
          <p>{error}</p>
          <p style={{ color: "var(--pg-text-tertiary)" }}>
            复杂动画、SmartArt、图表、公式和字体替换不保证完整还原；可下载原始文件继续阅读。
          </p>
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

  if (!documentModel) return null;

  return (
    <div class="pg-pptx-reader">
      <div class="pg-reader-toolbar" role="toolbar" aria-label="幻灯片阅读工具栏">
        <button
          class="pg-button"
          type="button"
          onClick={() => jumpToSlide(currentSlide - 1)}
          disabled={currentSlide <= 1}
        >
          上一页
        </button>
        <label class="pg-page-jump">
          <select
            class="pg-select"
            value={currentSlide}
            onChange={(event) =>
              jumpToSlide(Number((event.currentTarget as HTMLSelectElement).value))
            }
            aria-label="跳转幻灯片"
          >
            {documentModel.slides.map((slide) => (
              <option key={slide.number} value={slide.number}>
                第 {slide.number} 页
              </option>
            ))}
          </select>
          <span>/ {documentModel.slides.length}</span>
        </label>
        <button
          class="pg-button"
          type="button"
          onClick={() => jumpToSlide(currentSlide + 1)}
          disabled={currentSlide >= documentModel.slides.length}
        >
          下一页
        </button>
        <select
          class="pg-select"
          value={layout}
          onChange={(event) =>
            setLayout((event.currentTarget as HTMLSelectElement).value as PdfLayout)
          }
          aria-label="幻灯片页面布局"
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
          aria-label="幻灯片缩放模式"
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
            aria-label="幻灯片缩放比例"
          />
        ) : null}
        <span class="pg-spacer" />
        <button class="pg-button" type="button" onClick={() => void onDownload(resource)}>
          <DownloadIcon /> 下载
        </button>
      </div>
      {documentModel.warnings.length ? (
        <div class="pg-compat-warning" role="status">
          {documentModel.warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      ) : null}
      <div
        ref={scrollRef}
        class="pg-pptx-scroll"
        data-layout={layout}
        onScroll={handleScroll}
        tabIndex={0}
      >
        <div class="pg-pptx-grid">
          {documentModel.slides.map((slide) => (
            <SlideView key={slide.number} slide={slide} scale={scale} />
          ))}
        </div>
      </div>
    </div>
  );
}
