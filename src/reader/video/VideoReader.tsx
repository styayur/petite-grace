import { useEffect, useRef, useState } from "preact/hooks";
import type {
  AuthorizedPlayback,
  CourseAdapter,
  ResourceRecord,
} from "../../platform/xiaoya/types";
import { settingsRepository } from "../../storage/repositories";

interface VideoReaderProps {
  resource: ResourceRecord;
  adapter: CourseAdapter;
  onNotify: (message: string, tone?: "info" | "error") => void;
}

function positionKey(resource: ResourceRecord): string {
  return `videoPosition:${resource.courseId}:${resource.id}`;
}

export function VideoReader({ resource, adapter, onNotify }: VideoReaderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [playback, setPlayback] = useState<AuthorizedPlayback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [savedPosition, setSavedPosition] = useState(0);

  const resolve = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!adapter.resolveVideoPlayback) {
        throw new Error("当前平台适配器不支持视频播放");
      }
      const resolved = await adapter.resolveVideoPlayback(resource);
      setPlayback(resolved);
      const position = await settingsRepository.get(positionKey(resource), 0);
      setSavedPosition(Number(position) || 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "视频授权失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPlayback(null);
    setError(null);
    void resolve();
    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [resource.id, adapter]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playback) return;
    let disposed = false;
    hlsRef.current?.destroy();
    hlsRef.current = null;

    const setup = async () => {
      if (playback.kind === "mp4") {
        video.src = playback.url;
        return;
      }
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = playback.url;
        return;
      }
      try {
        const { default: Hls } = await import("hls.js");
        if (disposed) return;
        if (!Hls.isSupported()) {
          throw new Error("当前浏览器不支持 HLS 播放");
        }
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 30,
        });
        hlsRef.current = hls;
        hls.loadSource(playback.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && data.details.includes("manifest")) {
            setError("视频授权已过期或播放地址失效，请刷新授权后重试");
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            setError("当前视频编码不受支持或媒体数据损坏");
          } else {
            setError("HLS 视频播放失败");
          }
          hls.destroy();
          hlsRef.current = null;
        });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "HLS 初始化失败");
      }
    };
    void setup();
    return () => {
      disposed = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [playback]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    const restore = () => {
      if (!cancelled && savedPosition > 0 && savedPosition < video.duration - 2) {
        video.currentTime = savedPosition;
        onNotify(`已恢复到 ${Math.floor(savedPosition / 60)} 分钟处`, "info");
      }
    };
    video.addEventListener("loadedmetadata", restore, { once: true });
    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", restore);
    };
  }, [savedPosition, playback]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let lastSaved = 0;
    const save = () => {
      if (!Number.isFinite(video.currentTime)) return;
      void settingsRepository.put(positionKey(resource), video.currentTime);
      lastSaved = video.currentTime;
    };
    const onTimeUpdate = () => {
      if (Math.abs(video.currentTime - lastSaved) >= 5) save();
    };
    const onEnded = () => {
      void settingsRepository.put(positionKey(resource), 0);
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("pause", save);
    video.addEventListener("ended", onEnded);
    return () => {
      save();
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("pause", save);
      video.removeEventListener("ended", onEnded);
    };
  }, [resource.id]);

  const fullscreen = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.requestFullscreen) await video.requestFullscreen();
    else onNotify("当前浏览器不支持视频全屏", "info");
  };

  const pictureInPicture = async () => {
    const video = videoRef.current as HTMLVideoElement & {
      requestPictureInPicture?: () => Promise<unknown>;
    };
    if (!video?.requestPictureInPicture) {
      onNotify("当前浏览器不支持画中画", "info");
      return;
    }
    try {
      await video.requestPictureInPicture();
    } catch {
      onNotify("无法进入画中画模式", "info");
    }
  };

  if (loading) {
    return (
      <div class="pg-reader-loading">
        <div class="pg-progress">
          <span style={{ width: "45%" }} />
        </div>
        <p>正在获取视频播放授权…</p>
      </div>
    );
  }

  if (error || !playback) {
    return (
      <div class="pg-empty">
        <div class="pg-empty-card">
          <h2>无法在工作区内播放视频</h2>
          <p>{error ?? "平台没有返回可用播放地址"}</p>
          <p class="pg-muted">不会记录或导出签名播放地址。可重新授权，或返回平台原生播放器。</p>
          <div class="pg-video-actions">
            <button
              class="pg-button pg-button-primary"
              type="button"
              onClick={() => void resolve()}
            >
              重新获取授权
            </button>
            <a
              class="pg-button"
              href={playback?.fallbackPlatformUrl ?? window.location.href}
              target="_blank"
              rel="noreferrer"
            >
              返回平台播放
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="pg-video-reader">
      <div class="pg-video-stage">
        <video
          ref={videoRef}
          controls
          playsInline
          preload="none"
          aria-label={resource.title}
          onError={() => {
            const code = videoRef.current?.error?.code;
            if (code === MediaError.MEDIA_ERR_DECODE) setError("视频编码无法解码");
            else if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED)
              setError("当前浏览器不支持该视频源");
            else setError("视频播放失败");
          }}
        />
      </div>
      <div class="pg-video-toolbar" role="toolbar" aria-label="视频播放工具栏">
        <strong title={resource.title}>{resource.title}</strong>
        <span class="pg-spacer" />
        <label class="pg-video-speed">
          速度
          <select
            class="pg-select"
            value={playbackRate}
            onChange={(event) =>
              setPlaybackRate(Number((event.currentTarget as HTMLSelectElement).value))
            }
            aria-label="播放速度"
          >
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
              <option key={rate} value={rate}>
                {rate}×
              </option>
            ))}
          </select>
        </label>
        <button class="pg-button" type="button" onClick={() => void pictureInPicture()}>
          画中画
        </button>
        <button class="pg-button" type="button" onClick={() => void fullscreen()}>
          全屏
        </button>
        <a class="pg-button" href={playback.fallbackPlatformUrl} target="_blank" rel="noreferrer">
          平台播放
        </a>
      </div>
    </div>
  );
}
