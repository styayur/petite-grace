import { useEffect, useRef, useState } from "preact/hooks";
import type { CourseAdapter, ResourceRecord } from "../platform/xiaoya/types";
import { DownloadIcon, FileIcon } from "../ui/icons";
import { resourceKindLabel } from "../ui/format";

interface ResourceViewerProps {
  resource: ResourceRecord | null;
  adapter: CourseAdapter;
  onDownload: (resource: ResourceRecord) => void | Promise<void>;
  onNotify: (message: string, tone?: "info" | "error") => void;
}

function useObjectUrl(resource: ResourceRecord | null, adapter: CourseAdapter) {
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
    if (!resource || !["pdf", "image", "presentation"].includes(resource.kind)) return;
    setLoading(true);
    void adapter
      .fetchResourceBytes(resource)
      .then((bytes) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(
          new Blob([bytes], {
            type:
              resource.mimeType ??
              (resource.kind === "pdf"
                ? "application/pdf"
                : resource.kind === "presentation"
                  ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  : "application/octet-stream"),
          }),
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
  const { url, loading, error } = useObjectUrl(resource, adapter);

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

  if (loading) {
    return (
      <div class="pg-empty">
        <div class="pg-empty-card">
          <div class="pg-progress" style={{ marginBottom: "12px" }}>
            <span style={{ width: "40%" }} />
          </div>
          <p>正在读取 {resource.title}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div class="pg-empty">
        <div class="pg-empty-card">
          <h2>无法预览此资源</h2>
          <p>{error}</p>
          <p style={{ color: "var(--pg-text-tertiary)" }}>
            为避免把平台登录凭证发送给外域，Petite Grace 不会把 Bearer Token 附加到第三方地址。
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

  if (resource.kind === "pdf" && url) {
    return (
      <iframe
        title={resource.title}
        src={url}
        style={{ border: 0, width: "100%", height: "100%", background: "var(--pg-bg-sunken)" }}
      />
    );
  }

  if (resource.kind === "image" && url) {
    return (
      <div style={{ minHeight: "100%", display: "grid", placeItems: "center", padding: "24px" }}>
        <img
          src={url}
          alt={resource.title}
          style={{
            maxWidth: "100%",
            maxHeight: "calc(100vh - 130px)",
            borderRadius: "10px",
            boxShadow: "var(--pg-shadow-md)",
          }}
        />
      </div>
    );
  }

  if (resource.kind === "presentation") {
    return (
      <div class="pg-empty">
        <div class="pg-empty-card">
          <h2>{resource.title}</h2>
          <p>
            当前版本已识别 PPT/PPTX，但完整幻灯片阅读器将在 v0.2.0
            接入。现在可以下载原始文件，或在平台页面中打开。
          </p>
          {url ? (
            <a class="pg-button pg-button-primary" href={url} target="_blank" rel="noreferrer">
              打开本地预览
            </a>
          ) : null}
          <button class="pg-button" type="button" onClick={() => void onDownload(resource)}>
            <DownloadIcon /> 下载原始文件
          </button>
        </div>
      </div>
    );
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
