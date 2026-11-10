import { useEffect, useRef, useState } from "preact/hooks";
import type { CourseAdapter, ResourceRecord } from "../platform/xiaoya/types";
import type { Annotation } from "../annotations/types";
import type { ProviderConfig } from "../ai/types";
import type { ExerciseQuestion } from "../exercises/types";
import { ExerciseReader } from "../exercises/ExerciseReader";
import { DownloadIcon, FileIcon } from "../ui/icons";
import { resourceKindLabel } from "../ui/format";
import { PdfReader } from "./pdf/PdfReader";
import { PptxReader } from "./presentation/PptxReader";
import { VideoReader } from "./video/VideoReader";

interface ResourceViewerProps {
  resource: ResourceRecord | null;
  adapter: CourseAdapter;
  onDownload: (resource: ResourceRecord) => void | Promise<void>;
  onNotify: (message: string, tone?: "info" | "error") => void;
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  focusAnnotationId: string | null;
  onCreateAnnotation: (annotation: Annotation) => void | Promise<void>;
  onSelectAnnotation: (annotation: Annotation | null) => void;
  onRelocateAnnotations: (
    updates: Array<{ id: string; page: number; needsRelocation: boolean }>,
  ) => void | Promise<void>;
  providerConfigs: ProviderConfig[];
  onOpenAiSettings: () => void;
  onCreateReview: (question: ExerciseQuestion, aiText: string | null) => void;
}

function useImageUrl(resource: ResourceRecord | null, adapter: CourseAdapter) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setUrl(null);
    setError(null);
    if (!resource || resource.kind !== "image") return;
    setLoading(true);
    void adapter
      .fetchResourceBytes(resource, { signal: abortController.signal })
      .then((bytes) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(
          new Blob([bytes], { type: resource.mimeType ?? "application/octet-stream" }),
        );
        urlRef.current = objectUrl;
        setUrl(objectUrl);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "资源加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      abortController.abort();
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [resource, adapter]);

  return { url, loading, error };
}

export function ResourceViewer({
  resource,
  adapter,
  onDownload,
  onNotify,
  annotations,
  selectedAnnotationId,
  focusAnnotationId,
  onCreateAnnotation,
  onSelectAnnotation,
  onRelocateAnnotations,
  providerConfigs,
  onOpenAiSettings,
  onCreateReview,
}: ResourceViewerProps) {
  const image = useImageUrl(resource, adapter);

  if (!resource) {
    return (
      <div class="pg-empty">
        <div class="pg-empty-card">
          <h2>从一个资源开始</h2>
          <p>在左侧章节树或下方资源列表中选择 PDF、图片、PPTX 或作业资源。</p>
        </div>
      </div>
    );
  }

  if (resource.kind === "pdf") {
    return (
      <PdfReader
        key={resource.id}
        resource={resource}
        adapter={adapter}
        onDownload={onDownload}
        onNotify={onNotify}
        annotations={annotations}
        selectedAnnotationId={selectedAnnotationId}
        focusAnnotationId={focusAnnotationId}
        onCreateAnnotation={onCreateAnnotation}
        onSelectAnnotation={onSelectAnnotation}
        onRelocateAnnotations={onRelocateAnnotations}
      />
    );
  }

  if (resource.kind === "presentation") {
    return (
      <PptxReader
        key={resource.id}
        resource={resource}
        adapter={adapter}
        onDownload={onDownload}
        onNotify={onNotify}
      />
    );
  }

  if (resource.kind === "exercise") {
    return (
      <ExerciseReader
        key={resource.id}
        resource={resource}
        adapter={adapter}
        providerConfigs={providerConfigs}
        onOpenAiSettings={onOpenAiSettings}
        onDownload={onDownload}
        onNotify={onNotify}
        onCreateReview={onCreateReview}
      />
    );
  }

  if (resource.kind === "image") {
    if (image.loading) {
      return (
        <div class="pg-reader-loading">
          <div class="pg-progress">
            <span style={{ width: "40%" }} />
          </div>
          <p>正在读取 {resource.title}</p>
        </div>
      );
    }
    if (image.error) {
      return (
        <div class="pg-empty">
          <div class="pg-empty-card">
            <h2>无法预览图片</h2>
            <p>{image.error}</p>
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
    if (image.url) {
      return (
        <div class="pg-image-viewer">
          <img src={image.url} alt={resource.title} />
        </div>
      );
    }
  }

  if (resource.kind === "video") {
    return (
      <VideoReader key={resource.id} resource={resource} adapter={adapter} onNotify={onNotify} />
    );
  }

  return (
    <div class="pg-empty">
      <div class="pg-empty-card">
        <div style={{ display: "grid", placeItems: "center", marginBottom: "12px" }}>
          <FileIcon />
        </div>
        <h2>{resource.title}</h2>
        <p>
          {resourceKindLabel(resource.kind)} · {resource.mimeType ?? "未提供 MIME 类型"}
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
