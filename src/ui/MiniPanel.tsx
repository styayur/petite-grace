import { useRef, useState } from "preact/hooks";
import { ExpandIcon, MinimizeIcon } from "./icons";

interface MiniPanelProps {
  courseTitle: string | null;
  resourceTitle: string | null;
  status: string;
  onOpen: () => void;
}

interface Position {
  x: number;
  y: number;
}

export function MiniPanel({ courseTitle, resourceTitle, status, onOpen }: MiniPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const startDrag = (event: PointerEvent) => {
    if ((event.target as HTMLElement).closest("button")) return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const drag = (event: PointerEvent) => {
    if (!dragRef.current) return;
    const width = panelRef.current?.offsetWidth ?? 260;
    const height = panelRef.current?.offsetHeight ?? 120;
    const x = Math.min(
      window.innerWidth - width - 8,
      Math.max(8, event.clientX - dragRef.current.dx),
    );
    const y = Math.min(
      window.innerHeight - height - 8,
      Math.max(8, event.clientY - dragRef.current.dy),
    );
    setPosition({ x, y });
  };

  const endDrag = () => {
    dragRef.current = null;
    if (!position || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const snapRight = rect.left + rect.width / 2 > window.innerWidth / 2;
    setPosition({ x: snapRight ? window.innerWidth - rect.width - 18 : 18, y: rect.top });
  };

  return (
    <div
      ref={panelRef}
      class={`pg-mini${collapsed ? " collapsed" : ""}`}
      style={
        position
          ? { left: `${position.x}px`, top: `${position.y}px`, right: "auto", bottom: "auto" }
          : undefined
      }
      role="complementary"
      aria-label="Petite Grace 迷你工作台"
    >
      <div
        class="pg-mini-head"
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span class="pg-brand-mark" aria-hidden="true">
          PG
        </span>
        {!collapsed ? (
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontWeight: 650,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {courseTitle ?? "Petite Grace"}
            </div>
            <div style={{ color: "var(--pg-text-tertiary)", fontSize: "11px" }}>{status}</div>
          </div>
        ) : null}
        <button
          class="pg-icon-button"
          type="button"
          title={collapsed ? "展开" : "折叠"}
          aria-label={collapsed ? "展开迷你工作台" : "折叠迷你工作台"}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ExpandIcon /> : <MinimizeIcon />}
        </button>
      </div>
      {!collapsed ? (
        <div class="pg-mini-body">
          <div class="pg-mini-status" title={resourceTitle ?? undefined}>
            {resourceTitle ?? "选择一门课程后开始学习"}
          </div>
          <div class="pg-mini-actions">
            <button class="pg-button pg-button-primary" type="button" onClick={onOpen}>
              <ExpandIcon /> 打开工作区
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
