import { useEffect, useMemo, useState } from "preact/hooks";
import type { CourseSnapshot, ResourceRecord } from "../platform/xiaoya/types";
import { downloadIcon, resourceKindLabel, searchIcon } from "./sidebar-utils";
import { ChevronDown, ChevronRight, DownloadIcon, SearchIcon } from "../ui/icons";
import { resourceKindLabel as kindLabel } from "../ui/format";

interface CourseSidebarProps {
  course: CourseSnapshot;
  activeChapterId: string | null;
  selectedResourceId: string | null;
  defaultExpanded: boolean;
  onChapterSelect: (chapterId: string) => void;
  onResourceSelect: (resource: ResourceRecord) => void;
  onDownload: (resource: ResourceRecord) => void | Promise<void>;
}

interface TreeProps extends CourseSidebarProps {
  chapterId: string;
  depth: number;
  expanded: Set<string>;
  onToggle: (chapterId: string) => void;
  query: string;
}

function ChapterTree(props: TreeProps) {
  const { course, chapterId, depth, expanded, onToggle, query, activeChapterId, onChapterSelect } =
    props;
  const chapter = course.chapters.find((item) => item.id === chapterId);
  if (!chapter) return null;
  const children = chapter.childChapterIds
    .map((id) => course.chapters.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const matchesSelf = !query || chapter.title.toLowerCase().includes(query.toLowerCase());
  const hasMatchingDescendant = children.some((child) => {
    if (!query) return true;
    const resourceMatch = course.resources.some(
      (resource) =>
        resource.chapterId === child.id &&
        resource.title.toLowerCase().includes(query.toLowerCase()),
    );
    return child.title.toLowerCase().includes(query.toLowerCase()) || resourceMatch;
  });
  if (query && !matchesSelf && !hasMatchingDescendant) return null;
  const isOpen = expanded.has(chapter.id) || Boolean(query);
  return (
    <div>
      <div
        class={`pg-tree-row${activeChapterId === chapter.id ? " selected" : ""}`}
        style={{ paddingLeft: `${7 + depth * 13}px` }}
        role="treeitem"
        aria-expanded={children.length > 0 ? isOpen : undefined}
        tabIndex={0}
        onClick={() => {
          onChapterSelect(chapter.id);
          if (children.length) onToggle(chapter.id);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onChapterSelect(chapter.id);
            if (children.length) onToggle(chapter.id);
          }
        }}
      >
        <span class="pg-chevron">
          {children.length ? isOpen ? <ChevronDown /> : <ChevronRight /> : null}
        </span>
        <span class="pg-tree-label">{chapter.title}</span>
        <span class="pg-badge">{chapter.resourceIds.length}</span>
      </div>
      {isOpen && children.length ? (
        <div class="pg-tree-children" role="group">
          {children.map((child) => (
            <ChapterTree {...props} key={child.id} chapterId={child.id} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ResourceRow({
  resource,
  selected,
  onSelect,
  onDownload,
}: {
  resource: ResourceRecord;
  selected: boolean;
  onSelect: () => void;
  onDownload: () => void;
}) {
  return (
    <div
      class={`pg-resource-row${selected ? " selected" : ""}`}
      role="treeitem"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      title={resource.title}
    >
      <span class="pg-resource-icon" aria-hidden="true">
        {kindLabel(resource.kind)}
      </span>
      <span class="pg-resource-label">{resource.title}</span>
      <span class="pg-resource-meta">{resourceKindLabel(resource.kind)}</span>
      <span class="pg-resource-actions">
        <button
          type="button"
          title={`下载 ${resource.title}`}
          aria-label={`下载 ${resource.title}`}
          onClick={(event) => {
            event.stopPropagation();
            onDownload();
          }}
        >
          <DownloadIcon />
        </button>
      </span>
    </div>
  );
}

export function CourseSidebar(props: CourseSidebarProps) {
  const {
    course,
    activeChapterId,
    selectedResourceId,
    onChapterSelect,
    onResourceSelect,
    onDownload,
  } = props;
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(course.rootChapterIds.slice(0, 2)),
  );
  const [query, setQuery] = useState("");
  const [resourceScope, setResourceScope] = useState<"chapter" | "all">("chapter");
  const [split, setSplit] = useState(52);

  useEffect(() => {
    setExpanded((previous) => {
      const next = new Set(previous);
      for (const id of course.rootChapterIds) next.add(id);
      return next;
    });
  }, [course.courseId, course.rootChapterIds]);

  const visibleResources = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return course.resources
      .filter(
        (resource) =>
          resourceScope === "all" || !activeChapterId || resource.chapterId === activeChapterId,
      )
      .filter((resource) => !normalized || resource.title.toLowerCase().includes(normalized))
      .sort((a, b) => a.displayOrder - b.displayOrder || a.sourceIndex - b.sourceIndex);
  }, [course.resources, activeChapterId, resourceScope, query]);

  const toggle = (chapterId: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  };

  const startResize = (event: PointerEvent) => {
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const container = target.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const move = (moveEvent: PointerEvent) => {
      const next = Math.min(78, Math.max(24, ((moveEvent.clientY - rect.top) / rect.height) * 100));
      setSplit(next);
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  };

  return (
    <aside class="pg-sidebar">
      <section class="pg-sidebar-section" style={{ flex: `0 0 ${split}%` }} aria-label="课程章节">
        <div class="pg-section-header">
          <span class="pg-section-title">章节</span>
          <span class="pg-spacer" />
          <span class="pg-badge">{course.chapters.length}</span>
        </div>
        <div class="pg-search-wrap">
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: "9px",
                top: "7px",
                color: "var(--pg-text-tertiary)",
              }}
            >
              <SearchIcon />
            </span>
            <input
              class="pg-input"
              style={{ paddingLeft: "34px" }}
              value={query}
              onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)}
              placeholder="搜索章节或资源"
              aria-label="搜索章节或资源"
            />
          </div>
        </div>
        <div class="pg-tree" role="tree" aria-label="课程章节树">
          {course.rootChapterIds.map((chapterId) => (
            <ChapterTree
              {...props}
              key={chapterId}
              chapterId={chapterId}
              depth={0}
              expanded={expanded}
              onToggle={toggle}
              query={query.trim()}
            />
          ))}
          {course.orphanResourceIds.length ? (
            <div class="pg-tree-row" aria-label="未归档资源">
              <span class="pg-chevron" />
              <span class="pg-tree-label">未归档资源</span>
              <span class="pg-badge">{course.orphanResourceIds.length}</span>
            </div>
          ) : null}
        </div>
      </section>
      <div
        class="pg-splitter"
        onPointerDown={startResize}
        role="separator"
        aria-orientation="horizontal"
      />
      <section class="pg-sidebar-section" aria-label="课程资源">
        <div class="pg-section-header">
          <span class="pg-section-title">资源</span>
          <span class="pg-spacer" />
          <select
            class="pg-select"
            style={{ width: "auto", minHeight: 28, padding: "2px 6px" }}
            value={resourceScope}
            onInput={(event) =>
              setResourceScope(
                (event.currentTarget as HTMLSelectElement).value as "chapter" | "all",
              )
            }
            aria-label="资源范围"
          >
            <option value="chapter">当前章节</option>
            <option value="all">全部资源</option>
          </select>
        </div>
        <div class="pg-resource-list" role="tree" aria-label="课程资源列表">
          {visibleResources.map((resource) => (
            <ResourceRow
              key={resource.id}
              resource={resource}
              selected={selectedResourceId === resource.id}
              onSelect={() => onResourceSelect(resource)}
              onDownload={() => void onDownload(resource)}
            />
          ))}
          {visibleResources.length === 0 ? (
            <div class="pg-empty" style={{ padding: "24px 12px" }}>
              当前范围没有资源
            </div>
          ) : null}
        </div>
      </section>
    </aside>
  );
}
