import { useEffect, useRef, useState } from "preact/hooks";
import type { CourseAdapter, ResourceRecord } from "../platform/xiaoya/types";
import { DownloadIcon, FileIcon } from "../ui/icons";
import { resourceKindLabel } from "../ui/format";
import { PdfReader } from "./pdf/PdfReader";
import { PptxReader } from "./presentation/PptxReader";

interface ResourceViewerProps {
  resource: ResourceRecord | null;
  adapter: CourseAdapter;
  onDownload: (resource: ResourceRecord) => void | Promise<void>;
  onNotify: (message: string, tone?: "info" | "error") => void;
}

function useImageUrl(resource: ResourceRecord | null, adapter: CourseAdapter) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setUrl(null);
    setError(null);
    if (!resource || resource.kind !== "image") return;
    setLoading(true);
    void adapter
      .fetchResourceBytes(resource)
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
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [resource, adapter]);

  return { url, loading, error };
}

export function ResourceViewer({ resource, adapter, onDownload, onNotify }: ResourceViewerProps) {
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
      <div class="pg-empty">
        <div class="pg-empty-card">
          <h2>{resource.title}</h2>
          <p>视频资源保留平台播放能力，不在工作区内重复实现受限播放器。</p>
          <button
            class="pg-button pg-button-primary"
            type="button"
            onClick={() => void onDownload(resource)}
          >
            <DownloadIcon /> 下载视频
          </button>
        </div>
      </div>
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
