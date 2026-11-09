import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { App } from "../app/App";
import { isXiaoyaCoursePage } from "../platform/xiaoya/detect";
import { XiaoyaApiClient } from "../platform/xiaoya/api";
import type { CourseSnapshot } from "../platform/xiaoya/types";
import { MiniPanel } from "../ui/MiniPanel";
import baseStyles from "../ui/base.css?inline";

const HOST_ID = "petite-grace-root";

function PetiteGraceLauncher() {
  const adapter = new XiaoyaApiClient();
  const [open, setOpen] = useState(false);
  const [course, setCourse] = useState<CourseSnapshot | null>(null);
  const [status, setStatus] = useState("正在识别课程…");

  useEffect(() => {
    const courseId = adapter.getCourseId();
    if (!courseId) {
      setStatus("未识别到课程");
      return;
    }
    let cancelled = false;
    void adapter
      .loadCourse(courseId)
      .then((snapshot) => {
        if (cancelled) return;
        setCourse(snapshot);
        setStatus(`已读取 ${snapshot.chapters.length} 个章节`);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setStatus(reason instanceof Error ? reason.message : "课程读取失败");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTitle =
    course?.resources.find((resource) => resource.chapterId === course.rootChapterIds[0])?.title ??
    null;

  return (
    <>
      {open ? (
        <App adapter={adapter} initialCourse={course ?? undefined} onClose={() => setOpen(false)} />
      ) : (
        <MiniPanel
          courseTitle={course?.title ?? null}
          resourceTitle={selectedTitle}
          status={status}
          onOpen={() => setOpen(true)}
        />
      )}
    </>
  );
}

function mount(): void {
  if (document.getElementById(HOST_ID)) return;
  if (!isXiaoyaCoursePage(window.location)) return;
  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.all = "initial";
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = baseStyles;
  shadow.appendChild(style);
  const root = document.createElement("div");
  shadow.appendChild(root);
  render(<PetiteGraceLauncher />, root);
}

mount();
