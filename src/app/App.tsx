import { useEffect, useMemo, useState } from "preact/hooks";
import { CourseSidebar } from "../library/CourseSidebar";
import { AnnotationPanel } from "../annotations/AnnotationPanel";
import type { Annotation } from "../annotations/types";
import {
  annotationDocumentId,
  parseAnnotationsImport,
  serializeAnnotations,
} from "../annotations/service";
import type { CourseAdapter, CourseSnapshot, ResourceRecord } from "../platform/xiaoya/types";
import { ResourceViewer } from "../reader/ResourceViewer";
import { saveBlob, DownloadQueue, type DownloadTask } from "../downloads/queue";
import {
  annotationRepository,
  coursesRepository,
  reviewRepository,
  settingsRepository,
} from "../storage/repositories";
import {
  CloseIcon,
  DownloadIcon,
  ExpandIcon,
  SettingsIcon,
  MoonIcon,
  PanelLeftIcon,
  PanelRightIcon,
  SunIcon,
} from "../ui/icons";
import { formatBytes } from "../ui/format";
import { AiSettingsModal } from "../ai/AiSettingsModal";
import type { ProviderConfig } from "../ai/types";
import { loadProviderConfigs, saveProviderConfigs } from "../ai/config-store";
import type { ExerciseQuestion } from "../exercises/types";
import { createReviewItem } from "../review/factory";
import baseStyles from "../ui/base.css?inline";

interface AppProps {
  adapter: CourseAdapter;
  initialCourse?: CourseSnapshot;
  onClose?: () => void;
}

interface Notice {
  message: string;
  tone: "info" | "error";
}

function getShadowHost(node: Node): HTMLElement | null {
  const root = node.getRootNode();
  return root instanceof ShadowRoot ? (root.host as HTMLElement) : null;
}

export function App({ adapter, initialCourse, onClose }: AppProps) {
  const [course, setCourse] = useState<CourseSnapshot | null>(initialCourse ?? null);
  const [loading, setLoading] = useState(!initialCourse);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [focusAnnotationId, setFocusAnnotationId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [focusModePanels, setFocusModePanels] = useState({ left: true, right: true });
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfig[]>([]);
  const [showAiSettings, setShowAiSettings] = useState(false);

  const selectedResource = useMemo(
    () => course?.resources.find((resource) => resource.id === selectedResourceId) ?? null,
    [course, selectedResourceId],
  );

  const downloadQueue = useMemo(
    () =>
      new DownloadQueue({
        concurrency: 2,
        onCompleted: (task, blob) => saveBlob(blob, task.name),
      }),
    [],
  );

  useEffect(() => downloadQueue.subscribe(setTasks), [downloadQueue]);

  useEffect(() => {
    const host = getShadowHost(document.createElement("div"));
    const root = document.querySelector("petite-grace-root");
    if (root) root.setAttribute("data-theme", theme);
    void host;
  }, [theme]);

  useEffect(() => {
    void settingsRepository.get("theme", "light").then((value) => {
      if (value === "dark" || value === "light") setTheme(value);
    });
  }, []);

  useEffect(() => {
    void loadProviderConfigs()
      .then(setProviderConfigs)
      .catch(() => setNotice({ message: "AI Provider 配置读取失败", tone: "error" }));
  }, []);
  useEffect(() => {
    if (initialCourse) return;
    const courseId = adapter.getCourseId();
    if (!courseId) {
      setLoading(false);
      setNotice({ message: "当前页面不是识别到的小雅课程页", tone: "error" });
      return;
    }
    let cancelled = false;
    setLoading(true);
    void coursesRepository
      .get(courseId)
      .then((cached) => {
        if (!cancelled && cached) setCourse(cached);
      })
      .catch(() => undefined);
    void adapter
      .loadCourse(courseId)
      .then((snapshot) => {
        if (cancelled) return;
        setCourse(snapshot);
        void coursesRepository.put(snapshot).catch(() => undefined);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setNotice({
          message: reason instanceof Error ? reason.message : "课程加载失败",
          tone: "error",
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [adapter, initialCourse]);

  useEffect(() => {
    if (!course || selectedResourceId) return;
    const firstChapter = course.rootChapterIds[0] ?? null;
    setActiveChapterId(firstChapter);
    const firstResource =
      course.resources.find((resource) => resource.chapterId === firstChapter) ??
      course.resources[0];
    if (firstResource) {
      setSelectedResourceId(firstResource.id);
      setActiveChapterId(firstResource.chapterId ?? firstChapter);
    }
  }, [course, selectedResourceId]);

  useEffect(() => {
    let cancelled = false;
    setAnnotations([]);
    setSelectedAnnotationId(null);
    setFocusAnnotationId(null);
    if (!selectedResource) return;
    const documentId = annotationDocumentId(selectedResource.courseId, selectedResource.id);
    void annotationRepository
      .listByDocument(documentId)
      .then((items) => {
        if (!cancelled) setAnnotations(items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [selectedResource?.id, selectedResource?.courseId]);

  const saveAnnotation = async (annotation: Annotation) => {
    await annotationRepository.put(annotation);
    setAnnotations((items) => {
      const next = items.filter((item) => item.id !== annotation.id);
      next.push(annotation);
      return next;
    });
    setSelectedAnnotationId(annotation.id);
  };

  const selectAnnotation = (annotation: Annotation | null) => {
    setSelectedAnnotationId(annotation?.id ?? null);
    if (!annotation) return;
    setFocusAnnotationId(null);
    window.setTimeout(() => setFocusAnnotationId(annotation.id), 0);
  };

  const updateAnnotationNote = (annotation: Annotation, note: string) => {
    const updated = { ...annotation, note, updatedAt: new Date().toISOString() };
    void saveAnnotation(updated);
  };

  const deleteAnnotation = (annotation: Annotation) => {
    void annotationRepository.delete(annotation.id);
    setAnnotations((items) => items.filter((item) => item.id !== annotation.id));
    if (selectedAnnotationId === annotation.id) setSelectedAnnotationId(null);
  };

  const relocateAnnotations = (
    updates: Array<{ id: string; page: number; needsRelocation: boolean }>,
  ) => {
    setAnnotations((items) => {
      const updateMap = new Map(updates.map((update) => [update.id, update]));
      return items.map((item) => {
        const update = updateMap.get(item.id);
        if (!update) return item;
        const next = {
          ...item,
          page: update.page,
          needsRelocation: update.needsRelocation,
          updatedAt: new Date().toISOString(),
        };
        void annotationRepository.put(next);
        return next;
      });
    });
  };

  const exportAnnotations = () => {
    if (!selectedResource || annotations.length === 0) return;
    const filename = `petite-grace-annotations-${selectedResource.id}.json`;
    saveBlob(new Blob([serializeAnnotations(annotations)], { type: "application/json" }), filename);
  };

  const importAnnotationsFile = (file: File) => {
    void file
      .text()
      .then(async (text) => {
        const imported = parseAnnotationsImport(text);
        await Promise.all(imported.map((annotation) => annotationRepository.put(annotation)));
        if (!selectedResource) return;
        const documentId = annotationDocumentId(selectedResource.courseId, selectedResource.id);
        const current = await annotationRepository.listByDocument(documentId);
        setAnnotations(current);
        setNotice({
          message: `已导入 ${imported.length} 条标注，当前文档 ${current.length} 条`,
          tone: "info",
        });
      })
      .catch((reason: unknown) => {
        setNotice({
          message: reason instanceof Error ? reason.message : "标注导入失败",
          tone: "error",
        });
      });
  };

  const saveAiConfigs = async (configs: ProviderConfig[]) => {
    await saveProviderConfigs(configs);
    setProviderConfigs(configs);
    setShowAiSettings(false);
    setNotice({ message: "AI Provider 设置已保存到本机", tone: "info" });
  };

  const createReviewFromExercise = (question: ExerciseQuestion, aiText: string | null) => {
    if (!selectedResource) return;
    const options = question.options.map((option) => `${option.label}. ${option.text}`).join("\n");
    const item = createReviewItem({
      front: `${question.stem}${options ? `\n${options}` : ""}`,
      back: question.verifiedAnswer ?? aiText ?? question.explanation ?? "请根据课程资料补充答案。",
      source: {
        type: "exercise",
        courseId: selectedResource.courseId,
        resourceId: selectedResource.id,
      },
    });
    void reviewRepository
      .put(item)
      .then(() => setNotice({ message: "已保存为复习项目", tone: "info" }))
      .catch(() => setNotice({ message: "复习项目保存失败", tone: "error" }));
  };
  const selectChapter = (chapterId: string) => {
    setActiveChapterId(chapterId);
    const nextResource = course?.resources
      .filter((resource) => resource.chapterId === chapterId)
      .sort((a, b) => a.displayOrder - b.displayOrder)[0];
    if (nextResource) setSelectedResourceId(nextResource.id);
  };

  const selectResource = (resource: ResourceRecord) => {
    setSelectedResourceId(resource.id);
    setActiveChapterId(resource.chapterId);
  };

  const downloadResource = async (resource: ResourceRecord) => {
    try {
      setNotice({ message: `正在准备 ${resource.title}`, tone: "info" });
      const url = await adapter.resolveResourceUrl(resource);
      downloadQueue.add({ name: resource.title, url });
      setNotice(null);
    } catch (reason) {
      setNotice({
        message: reason instanceof Error ? reason.message : "下载地址获取失败",
        tone: "error",
      });
    }
  };

  const toggleFocusMode = () => {
    if (focusMode) {
      setLeftOpen(focusModePanels.left);
      setRightOpen(focusModePanels.right);
      setFocusMode(false);
      return;
    }
    setFocusModePanels({ left: leftOpen, right: rightOpen });
    setLeftOpen(false);
    setRightOpen(false);
    setFocusMode(true);
  };
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    void settingsRepository.put("theme", next);
  };

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 7000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const activeDownloads = tasks.filter(
    (task) => task.status === "running" || task.status === "queued",
  );
  const failedDownloads = tasks.filter((task) => task.status === "failed");

  return (
    <div class="pg-shell" data-left={leftOpen ? "open" : "closed"} data-theme={theme}>
      <style>{baseStyles}</style>
      <header class="pg-topbar">
        <div class="pg-brand">
          <span class="pg-brand-mark" aria-hidden="true">
            PG
          </span>
          <span>Petite Grace</span>
        </div>
        <span class="pg-course-title" title={course?.title}>
          {course?.title ?? (loading ? "正在识别课程…" : "课程未加载")}
        </span>
        <span class="pg-spacer" />
        <div class="pg-toolbar">
          <button
            class={`pg-icon-button${leftOpen ? " selected" : ""}`}
            type="button"
            title="显示或隐藏章节栏"
            aria-label="显示或隐藏章节栏"
            aria-pressed={leftOpen}
            onClick={() => setLeftOpen((value) => !value)}
          >
            <PanelLeftIcon />
          </button>
          <button
            class={`pg-icon-button${rightOpen ? " selected" : ""}`}
            type="button"
            title="显示或隐藏信息栏"
            aria-label="显示或隐藏信息栏"
            aria-pressed={rightOpen}
            onClick={() => setRightOpen((value) => !value)}
          >
            <PanelRightIcon />
          </button>
          <button
            class={`pg-icon-button${focusMode ? " selected" : ""}`}
            type="button"
            title={focusMode ? "退出专注阅读" : "专注阅读"}
            aria-label={focusMode ? "退出专注阅读" : "专注阅读"}
            aria-pressed={focusMode}
            onClick={toggleFocusMode}
          >
            <ExpandIcon />
          </button>
          <button
            class="pg-icon-button"
            type="button"
            title="AI Provider 设置"
            aria-label="AI Provider 设置"
            onClick={() => setShowAiSettings(true)}
          >
            <SettingsIcon />
          </button>
          <button
            class="pg-icon-button"
            type="button"
            title={theme === "light" ? "切换到深色主题" : "切换到浅色主题"}
            aria-label={theme === "light" ? "切换到深色主题" : "切换到浅色主题"}
            onClick={toggleTheme}
          >
            {theme === "light" ? <MoonIcon /> : <SunIcon />}
          </button>
          {onClose ? (
            <button
              class="pg-icon-button"
              type="button"
              title="关闭工作区"
              aria-label="关闭工作区"
              onClick={onClose}
            >
              <CloseIcon />
            </button>
          ) : null}
        </div>
      </header>

      <div class={`pg-workspace${leftOpen ? "" : " no-left"}${rightOpen ? "" : " no-right"}`}>
        {leftOpen && course ? (
          <CourseSidebar
            course={course}
            activeChapterId={activeChapterId}
            selectedResourceId={selectedResourceId}
            defaultExpanded
            onChapterSelect={selectChapter}
            onResourceSelect={selectResource}
            onDownload={downloadResource}
          />
        ) : leftOpen ? (
          <aside class="pg-sidebar">
            <div class="pg-empty">正在加载章节…</div>
          </aside>
        ) : null}

        <main class="pg-main">
          <div class="pg-main-toolbar">
            <div class="pg-main-title" title={selectedResource?.title}>
              {selectedResource?.title ?? "学习工作区"}
            </div>
            {selectedResource ? (
              <button
                class="pg-button pg-button-subtle"
                type="button"
                onClick={() => void downloadResource(selectedResource)}
              >
                <DownloadIcon /> 下载
              </button>
            ) : null}
          </div>
          <div class="pg-reader-surface" id="petite-grace-reader-surface">
            <ResourceViewer
              resource={selectedResource}
              adapter={adapter}
              onDownload={downloadResource}
              onNotify={(message, tone = "info") => setNotice({ message, tone })}
              annotations={annotations}
              selectedAnnotationId={selectedAnnotationId}
              focusAnnotationId={focusAnnotationId}
              onCreateAnnotation={saveAnnotation}
              onSelectAnnotation={selectAnnotation}
              onRelocateAnnotations={relocateAnnotations}
              providerConfigs={providerConfigs}
              onOpenAiSettings={() => setShowAiSettings(true)}
              onCreateReview={createReviewFromExercise}
            />
          </div>
        </main>

        {rightOpen ? (
          <aside class="pg-inspector" aria-label="资源信息">
            <div>
              <h3>资源信息</h3>
              <dl class="pg-info-list">
                <div class="pg-info-row">
                  <dt>课程</dt>
                  <dd>{course?.title ?? "—"}</dd>
                </div>
                <div class="pg-info-row">
                  <dt>资源</dt>
                  <dd>{selectedResource?.title ?? "未选择"}</dd>
                </div>
                <div class="pg-info-row">
                  <dt>类型</dt>
                  <dd>{selectedResource?.mimeType ?? selectedResource?.kind ?? "—"}</dd>
                </div>
                <div class="pg-info-row">
                  <dt>章节</dt>
                  <dd>
                    {course?.chapters.find((chapter) => chapter.id === selectedResource?.chapterId)
                      ?.title ?? "未归档"}
                  </dd>
                </div>
                <div class="pg-info-row">
                  <dt>排序依据</dt>
                  <dd>
                    {course?.sortEvidence === "explicit-order-field"
                      ? "平台显式顺序字段"
                      : "平台原始顺序（回退）"}
                  </dd>
                </div>
                <div class="pg-info-row">
                  <dt>加载来源</dt>
                  <dd>{course?.source === "live" ? "当前登录会话" : "本地缓存 / fixture"}</dd>
                </div>
              </dl>
            </div>
            <div>
              <h3>下载队列</h3>
              {tasks.length === 0 ? (
                <p style={{ color: "var(--pg-text-tertiary)", fontSize: "12px" }}>暂无下载任务</p>
              ) : (
                <div style={{ display: "grid", gap: "8px" }}>
                  {tasks.slice(-5).map((task) => {
                    const ratio = task.total ? Math.round((task.loaded / task.total) * 100) : null;
                    return (
                      <div key={task.id}>
                        <div style={{ fontSize: "12px", display: "flex", gap: "8px" }}>
                          <span
                            style={{
                              flex: 1,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {task.name}
                          </span>
                          <span style={{ color: "var(--pg-text-tertiary)" }}>
                            {task.status === "completed"
                              ? formatBytes(task.loaded)
                              : ratio != null
                                ? `${ratio}%`
                                : task.status}
                          </span>
                        </div>
                        <div class="pg-progress" style={{ marginTop: "4px" }}>
                          <span
                            style={{ width: `${ratio ?? (task.status === "running" ? 20 : 0)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {activeDownloads.length ? (
                <p class="pg-badge">{activeDownloads.length} 个任务进行中</p>
              ) : null}
              {failedDownloads.length ? (
                <p class="pg-badge">{failedDownloads.length} 个任务失败</p>
              ) : null}
            </div>
            <AnnotationPanel
              annotations={annotations}
              selectedAnnotationId={selectedAnnotationId}
              onSelect={selectAnnotation}
              onUpdateNote={updateAnnotationNote}
              onDelete={deleteAnnotation}
              onExport={exportAnnotations}
              onImportFile={importAnnotationsFile}
            />
            <div style={{ marginTop: "auto", color: "var(--pg-text-tertiary)", fontSize: "11px" }}>
              本地优先 · 不上传课程内容 · 不保存登录 Token
            </div>
          </aside>
        ) : null}
      </div>

      {showAiSettings ? (
        <AiSettingsModal
          configs={providerConfigs}
          onClose={() => setShowAiSettings(false)}
          onSave={saveAiConfigs}
          onNotify={(message, tone = "info") => setNotice({ message, tone })}
        />
      ) : null}

      {notice ? (
        <div
          class="pg-statusbar"
          data-tone={notice.tone === "error" ? "error" : "info"}
          role="status"
        >
          {notice.message}
        </div>
      ) : null}
    </div>
  );
}
