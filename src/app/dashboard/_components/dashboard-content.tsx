// PROTOTYPE: Figma-Canvas — spatial canvas with drag-and-drop. Mock data.
"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MOCK_TASKS,
  MOCK_PROJECTS,
  PROJECT_COLORS,
  type MockTask,
} from "./mock-data";

// ── Types ────────────────────────────────────────────────────────────────────

interface CanvasTransform {
  x: number;
  y: number;
  scale: number;
}

type ViewMode = "detail" | "week" | "month";

interface DashboardContentProps {
  currentUser: unknown;
}

interface DragState {
  taskId: string;
  originLaneKey: string | null; // null = backlog
  offsetX: number;
  offsetY: number;
  currentX: number;
  currentY: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const LANE_WIDTH = 320;
const LANE_GAP = 24;
const CARD_WIDTH = 280;
const CARD_GAP = 8;
const LANE_TOP_PADDING = 60;
const BACKLOG_X = -500;
const MIN_SCALE = 0.2;
const MAX_SCALE = 3;

const STATUS_COLORS: Record<string, { dot: string; label: string }> = {
  todo: { dot: "#6B7280", label: "Todo" },
  in_progress: { dot: "#F59E0B", label: "In Progress" },
  done: { dot: "#10B981", label: "Done" },
  blocked: { dot: "#EF4444", label: "Blocked" },
};

// ── Date helpers ─────────────────────────────────────────────────────────────

function getWeekDates(weeksAround = 4) {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));

  const dates: Date[] = [];
  for (let w = -1; w <= weeksAround; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + w * 7 + d);
      dates.push(date);
    }
  }
  return dates;
}

function fmtKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDay(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
}

function fmtMonthDay(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isToday(d: Date) {
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

// ── Layout ───────────────────────────────────────────────────────────────────

interface Lane {
  date: Date;
  key: string;
  x: number;
}

function buildLanes(dates: Date[]) {
  let todayX = 0;
  const lanes: Lane[] = dates.map((date, i) => {
    const x = i * (LANE_WIDTH + LANE_GAP);
    const key = fmtKey(date);
    if (isToday(date)) todayX = x;
    return { date, key, x };
  });
  return { lanes, todayX };
}

function getTasksForLane(tasks: MockTask[], laneKey: string) {
  return tasks.filter((t) => t.due_date === laneKey || t.start_date === laneKey);
}

function getBacklogTasks(tasks: MockTask[]) {
  return tasks.filter((t) => !t.due_date && !t.start_date);
}

function groupByProject(tasks: MockTask[]) {
  const groups: Record<string, MockTask[]> = {};
  for (const t of tasks) {
    (groups[t.project_id] ??= []).push(t);
  }
  return groups;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function DashboardContent({ currentUser: _currentUser }: DashboardContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const transformLayerRef = useRef<HTMLDivElement>(null);

  // Tasks as mutable state for drag-and-drop
  const [tasks, setTasks] = useState<MockTask[]>(() => [...MOCK_TASKS]);

  // Canvas
  const [transform, setTransform] = useState<CanvasTransform>({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [initialized, setInitialized] = useState(false);

  // Selection
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Drag-and-drop
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragActive, setDragActive] = useState(false); // true once card moves past click threshold
  // undefined = no drag, null = over backlog, string = lane key
  const [dropTargetLane, setDropTargetLane] = useState<string | null | undefined>(undefined);
  const dragHasMoved = useRef(false);
  const dragStartScreen = useRef({ x: 0, y: 0 });

  // Data
  const dates = useMemo(() => getWeekDates(4), []);
  const { lanes, todayX } = useMemo(() => buildLanes(dates), [dates]);

  const viewMode: ViewMode = useMemo(() => {
    if (transform.scale > 1.5) return "detail";
    if (transform.scale < 0.7) return "month";
    return "week";
  }, [transform.scale]);

  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) ?? null : null;

  // ── Center on today ────────────────────────────────────────────────────

  useEffect(() => {
    if (initialized) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTransform({ x: -todayX + rect.width / 2 - LANE_WIDTH / 2, y: 40, scale: 1 });
    setInitialized(true);
  }, [todayX, initialized]);

  // ── Pan ────────────────────────────────────────────────────────────────

  const onPanStart = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-card]")) return;
      if ((e.target as HTMLElement).closest("[data-hud]")) return;
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
    },
    [transform.x, transform.y],
  );

  const onPanMove = useCallback(
    (e: React.MouseEvent) => {
      if (drag) return; // don't pan while dragging a card
      if (!isPanning) return;
      setTransform((prev) => ({
        ...prev,
        x: panStart.current.tx + (e.clientX - panStart.current.x),
        y: panStart.current.ty + (e.clientY - panStart.current.y),
      }));
    },
    [isPanning, drag],
  );

  const onPanEnd = useCallback(() => setIsPanning(false), []);

  // ── Wheel: Figma-style routing ─────────────────────────────────────────
  // ctrlKey = true  → pinch gesture or Ctrl+scroll → zoom toward cursor
  // ctrlKey = false → trackpad two-finger scroll or mouse wheel → pan

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;

    if (e.ctrlKey) {
      // Zoom toward cursor
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      // Pinch events have large fractional deltaY; scroll wheel gives ~100
      const factor = e.deltaY < 0 ? 1.08 : 0.92;

      setTransform((prev) => {
        const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor));
        const r = ns / prev.scale;
        return { scale: ns, x: cx - (cx - prev.x) * r, y: cy - (cy - prev.y) * r };
      });
    } else {
      // Pan — deltaX for horizontal (trackpad swipe), deltaY for vertical
      setTransform((prev) => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  }, []);

  // ── Keyboard (minimal — Figma-style supplementary) ─────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedTaskId(null);
        setDrag(null);
      }
      if (e.key === "0" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        setTransform({ x: -todayX + rect.width / 2 - LANE_WIDTH / 2, y: 40, scale: 1 });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [todayX]);

  // ── Drag-and-drop ─────────────────────────────────────────────────────

  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      return {
        x: (screenX - transform.x) / transform.scale,
        y: (screenY - transform.y) / transform.scale,
      };
    },
    [transform],
  );

  const findLaneAtPosition = useCallback(
    (canvasX: number): string | null => {
      for (const lane of lanes) {
        if (canvasX >= lane.x - LANE_GAP / 2 && canvasX < lane.x + LANE_WIDTH + LANE_GAP / 2) {
          return lane.key;
        }
      }
      // Check backlog
      if (canvasX < lanes[0]!.x - LANE_GAP / 2) return null; // backlog
      return null;
    },
    [lanes],
  );

  const onDragStart = useCallback(
    (e: React.MouseEvent, task: MockTask) => {
      e.stopPropagation();
      e.preventDefault();
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const canvasPos = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top);

      dragHasMoved.current = false;
      dragStartScreen.current = { x: e.clientX, y: e.clientY };
      setDragActive(false);
      setDropTargetLane(undefined);

      setDrag({
        taskId: task.id,
        originLaneKey: task.due_date ?? task.start_date ?? null,
        offsetX: 0,
        offsetY: 0,
        currentX: canvasPos.x,
        currentY: canvasPos.y,
      });
      setSelectedTaskId(task.id);
    },
    [screenToCanvas],
  );

  // Handle drag move at the window level for smooth tracking
  useEffect(() => {
    if (!drag) return;

    const onMove = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;

      // Only start visually dragging after moving 6px — distinguishes click from drag
      if (!dragHasMoved.current) {
        const dx = e.clientX - dragStartScreen.current.x;
        const dy = e.clientY - dragStartScreen.current.y;
        if (Math.sqrt(dx * dx + dy * dy) < 6) return;
        dragHasMoved.current = true;
        setDragActive(true);
      }

      const rect = el.getBoundingClientRect();
      const canvasPos = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top);

      setDrag((prev) =>
        prev ? { ...prev, currentX: canvasPos.x, currentY: canvasPos.y } : null,
      );

      setDropTargetLane(findLaneAtPosition(canvasPos.x));
    };

    const onUp = () => {
      // Only commit if the card actually moved to a new lane
      if (drag && dragHasMoved.current && dropTargetLane !== undefined) {
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id !== drag.taskId) return t;
            if (dropTargetLane === null) {
              return { ...t, due_date: null, start_date: null };
            }
            return { ...t, due_date: dropTargetLane };
          }),
        );
      }
      dragHasMoved.current = false;
      setDragActive(false);
      setDrag(null);
      setDropTargetLane(undefined);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, dropTargetLane, screenToCanvas, findLaneAtPosition]);

  // ── Render ─────────────────────────────────────────────────────────────

  const backlog = useMemo(() => getBacklogTasks(tasks), [tasks]);

  return (
    <div
      ref={containerRef}
      className="canvas-bg relative h-full w-full overflow-hidden"
      style={{ cursor: drag ? "grabbing" : isPanning ? "grabbing" : "grab" }}
      onMouseDown={onPanStart}
      onMouseMove={onPanMove}
      onMouseUp={onPanEnd}
      onMouseLeave={onPanEnd}
      onWheel={onWheel}
    >
      {/* Transform layer */}
      <div
        ref={transformLayerRef}
        className="absolute left-0 top-0 origin-top-left"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          willChange: "transform",
        }}
      >
        {/* Backlog zone */}
        <LaneColumn
          label="BACKLOG"
          x={BACKLOG_X}
          isToday={false}
          isDropTarget={dragActive && dropTargetLane === null}
          tasks={backlog}
          viewMode={viewMode}
          selectedTaskId={selectedTaskId}
          dragTaskId={drag?.taskId ?? null}
          dragActive={dragActive}
          onSelect={setSelectedTaskId}
          onDragStart={onDragStart}
        />

        {/* Day lanes */}
        {lanes.map((lane) => {
          const laneTasks = getTasksForLane(tasks, lane.key);
          return (
            <LaneColumn
              key={lane.key}
              label={fmtDay(lane.date)}
              sublabel={fmtMonthDay(lane.date)}
              x={lane.x}
              isToday={isToday(lane.date)}
              isDropTarget={dragActive && dropTargetLane === lane.key}
              tasks={laneTasks}
              viewMode={viewMode}
              selectedTaskId={selectedTaskId}
              dragTaskId={drag?.taskId ?? null}
              dragActive={dragActive}
              onSelect={setSelectedTaskId}
              onDragStart={onDragStart}
            />
          );
        })}

        {/* Drag ghost — only shown after card has moved past click threshold */}
        {drag && dragActive && <DragGhost drag={drag} tasks={tasks} />}
      </div>

      {/* HUD */}
      <HUD viewMode={viewMode} scale={transform.scale} />

      {/* Detail panel — Figma-style right sidebar */}
      <AnimatePresence>
        {selectedTask && !drag && (
          <DetailPanel task={selectedTask} onClose={() => setSelectedTaskId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Lane Column ──────────────────────────────────────────────────────────────

function LaneColumn({
  label,
  sublabel,
  x,
  isToday: today,
  isDropTarget,
  tasks,
  viewMode,
  selectedTaskId,
  dragTaskId,
  dragActive,
  onSelect,
  onDragStart,
}: {
  label: string;
  sublabel?: string;
  x: number;
  isToday: boolean;
  isDropTarget: boolean;
  tasks: MockTask[];
  viewMode: ViewMode;
  selectedTaskId: string | null;
  dragTaskId: string | null;
  dragActive: boolean;
  onSelect: (id: string | null) => void;
  onDragStart: (e: React.MouseEvent, task: MockTask) => void;
}) {
  const groups = groupByProject(tasks);

  // Month summary view
  if (viewMode === "month") {
    const projectCounts: Record<string, number> = {};
    tasks.forEach((t) => {
      projectCounts[t.project_id] = (projectCounts[t.project_id] ?? 0) + 1;
    });

    return (
      <div className="absolute" style={{ left: x, top: 0, width: LANE_WIDTH }}>
        <div
          className={`rounded-xl border p-4 transition-colors duration-150 ${
            isDropTarget
              ? "border-indigo-400/50 bg-indigo-500/[0.08]"
              : today
                ? "border-indigo-500/30 bg-indigo-500/[0.04]"
                : "border-white/[0.06] bg-white/[0.02]"
          }`}
          style={{ minHeight: 80 }}
        >
          <div className="mb-2 text-sm font-medium text-white/50">{label}</div>
          {Object.entries(projectCounts).map(([pid, count]) => {
            const c = PROJECT_COLORS[pid];
            return (
              <div key={pid} className="mb-1 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: c?.accent ?? "#666" }} />
                <span className="text-xs text-white/40">
                  {MOCK_PROJECTS.find((p) => p.id === pid)?.name} — {count}
                </span>
              </div>
            );
          })}
          {tasks.length === 0 && <span className="text-xs text-white/15">empty</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute" style={{ left: x, top: 0, width: LANE_WIDTH }}>
      {/* Lane divider */}
      <div
        className="absolute left-[-12px] top-0 h-[2000px] w-px"
        style={{
          background: today
            ? "linear-gradient(180deg, rgba(99,102,241,0.5) 0%, rgba(99,102,241,0) 100%)"
            : "rgba(255,255,255,0.04)",
        }}
      />

      {/* Drop target highlight */}
      {isDropTarget && (
        <div className="absolute inset-x-[-12px] top-0 h-[2000px] rounded-2xl border-2 border-dashed border-indigo-400/40 bg-indigo-500/[0.04] transition-opacity" />
      )}

      {/* Today glow */}
      {today && (
        <div className="absolute left-0 top-0 h-1 w-full rounded-full bg-indigo-500/60 shadow-[0_0_20px_rgba(99,102,241,0.4)]" />
      )}

      {/* Header */}
      <div className="mb-2 flex items-center gap-3">
        <span className={`text-lg font-semibold tracking-wide ${today ? "text-indigo-400" : "text-white/40"}`}>
          {label}
        </span>
        {sublabel && <span className="text-xs text-white/20">{sublabel}</span>}
        {today && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
          </span>
        )}
        {tasks.length > 0 && (
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/30">{tasks.length}</span>
        )}
      </div>

      {/* Cards */}
      <div style={{ paddingTop: LANE_TOP_PADDING }}>
        {Object.entries(groups).map(([projectId, projectTasks]) => {
          const project = MOCK_PROJECTS.find((p) => p.id === projectId);
          const colors = PROJECT_COLORS[projectId] ?? { accent: "#666", glass: "rgba(102,102,102,0.12)", glow: "rgba(102,102,102,0.3)", text: "#999" };

          return (
            <div key={projectId} className="mb-5">
              <div className="mb-1.5 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.accent }} />
                <span className="text-xs font-medium" style={{ color: colors.text }}>
                  {project?.name ?? "Unknown"}
                </span>
              </div>
              <div className="flex flex-col" style={{ gap: CARD_GAP }}>
                {projectTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    colors={colors}
                    viewMode={viewMode}
                    isSelected={selectedTaskId === task.id}
                    isDragging={dragTaskId === task.id && dragActive}
                    onSelect={() => onSelect(task.id)}
                    onDragStart={(e) => onDragStart(e, task)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {tasks.length === 0 && !isDropTarget && (
          <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-white/[0.06] text-xs text-white/15">
            No tasks
          </div>
        )}
        {tasks.length === 0 && isDropTarget && (
          <div className="flex h-20 items-center justify-center rounded-xl border-2 border-dashed border-indigo-400/30 text-xs text-indigo-400/40">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

// ── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  colors,
  viewMode,
  isSelected,
  isDragging,
  onSelect,
  onDragStart,
}: {
  task: MockTask;
  colors: { accent: string; glass: string; glow: string; text: string };
  viewMode: ViewMode;
  isSelected: boolean;
  isDragging: boolean;
  onSelect: () => void;
  onDragStart: (e: React.MouseEvent) => void;
}) {
  const status = STATUS_COLORS[task.status] ?? STATUS_COLORS.todo!;

  return (
    <div
      data-card
      className={`relative select-none overflow-hidden rounded-xl border transition-shadow duration-150 ${
        isDragging ? "opacity-30" : ""
      }`}
      style={{
        width: CARD_WIDTH,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        background: colors.glass,
        borderColor: isSelected ? colors.accent : "rgba(255,255,255,0.08)",
        boxShadow: isSelected
          ? `0 0 20px ${colors.glow}, 0 0 0 1px ${colors.accent}50`
          : `0 0 8px ${colors.glow.replace("0.3", "0.08")}, 0 2px 8px rgba(0,0,0,0.3)`,
        cursor: "grab",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        onDragStart(e);
      }}
    >
      {/* Selected accent strip */}
      {isSelected && (
        <div className="absolute left-0 top-0 h-full w-0.5" style={{ backgroundColor: colors.accent }} />
      )}

      <div className="p-3">
        {/* Status dot + title */}
        <div className="flex items-start gap-2">
          <span
            className="mt-1 h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: status.dot }}
          />
          <span
            className={`text-sm font-medium leading-snug ${task.status === "done" ? "line-through opacity-40" : ""}`}
            style={{ color: colors.text }}
          >
            {task.title}
          </span>
        </div>

        {/* Meta row */}
        <div className="mt-2 flex items-center gap-1.5">
          {task.estimated_hours && (
            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-white/30">
              {task.estimated_hours}h
            </span>
          )}
          {task.status === "blocked" && (
            <span className="rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400/60">
              blocked
            </span>
          )}
          <span className="ml-auto text-[10px] text-white/15">{status.label}</span>
        </div>

        {/* Show description in detail view */}
        {viewMode === "detail" && task.description && (
          <p className="mt-2 text-xs leading-relaxed text-white/20">{task.description}</p>
        )}
      </div>

      {/* Bottom accent */}
      <div
        className="h-0.5 w-full"
        style={{ background: `linear-gradient(90deg, ${colors.accent}40 0%, transparent 100%)` }}
      />
    </div>
  );
}

// ── Drag Ghost ───────────────────────────────────────────────────────────────

function DragGhost({ drag, tasks }: { drag: DragState; tasks: MockTask[] }) {
  const task = tasks.find((t) => t.id === drag.taskId);
  if (!task) return null;

  const colors = PROJECT_COLORS[task.project_id] ?? { accent: "#666", glass: "rgba(102,102,102,0.12)", glow: "rgba(102,102,102,0.3)", text: "#999" };

  return (
    <div
      className="pointer-events-none absolute z-50 rounded-xl border"
      style={{
        left: drag.currentX - CARD_WIDTH / 2,
        top: drag.currentY - 20,
        width: CARD_WIDTH,
        backdropFilter: "blur(12px)",
        background: colors.glass,
        borderColor: colors.accent,
        boxShadow: `0 0 30px ${colors.glow}, 0 8px 32px rgba(0,0,0,0.5)`,
        opacity: 0.9,
        transform: "rotate(2deg) scale(1.05)",
      }}
    >
      <div className="p-3">
        <div className="flex items-start gap-2">
          <span
            className="mt-1 h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: STATUS_COLORS[task.status]?.dot ?? "#666" }}
          />
          <span className="text-sm font-medium leading-snug" style={{ color: colors.text }}>
            {task.title}
          </span>
        </div>
      </div>
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${colors.accent}60 0%, transparent 100%)` }} />
    </div>
  );
}

// ── Detail Panel (Figma-style right sidebar) ─────────────────────────────────

function DetailPanel({ task, onClose }: { task: MockTask; onClose: () => void }) {
  const project = MOCK_PROJECTS.find((p) => p.id === task.project_id);
  const colors = PROJECT_COLORS[task.project_id] ?? { accent: "#666", glass: "rgba(102,102,102,0.12)", glow: "rgba(102,102,102,0.3)", text: "#999" };
  const status = STATUS_COLORS[task.status] ?? STATUS_COLORS.todo!;

  return (
    <motion.div
      data-hud
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="absolute right-0 top-0 flex h-full w-80 flex-col border-l border-white/[0.06]"
      style={{ background: "rgba(15, 15, 20, 0.92)", backdropFilter: "blur(20px)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.accent }} />
          <span className="text-xs font-medium text-white/50">{project?.name}</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/60"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {/* Title */}
        <h2 className="text-lg font-semibold leading-snug" style={{ color: colors.text }}>
          {task.title}
        </h2>

        {/* Status */}
        <div className="mt-4 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status.dot }} />
          <span className="text-sm text-white/50">{status.label}</span>
        </div>

        {/* Properties */}
        <div className="mt-6 space-y-4">
          <Property label="Priority" value={`P${task.priority}`} />
          {task.due_date && <Property label="Due" value={task.due_date} />}
          {task.start_date && <Property label="Start" value={task.start_date} />}
          {task.estimated_hours && <Property label="Estimate" value={`${task.estimated_hours}h`} />}
        </div>

        {/* Description */}
        {task.description && (
          <div className="mt-6">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-white/20">Description</div>
            <p className="text-sm leading-relaxed text-white/40">{task.description}</p>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="border-t border-white/[0.06] px-5 py-3">
        <span className="text-[10px] text-white/15">Drag card to reschedule · Click canvas to deselect</span>
      </div>
    </motion.div>
  );
}

function Property({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white/25">{label}</span>
      <span className="text-sm text-white/60">{value}</span>
    </div>
  );
}

// ── HUD ──────────────────────────────────────────────────────────────────────

function HUD({ viewMode, scale }: { viewMode: ViewMode; scale: number }) {
  const viewLabel = viewMode === "detail" ? "Detail" : viewMode === "month" ? "Month" : "Week";

  return (
    <>
      {/* Zoom — top right */}
      <div data-hud className="pointer-events-none absolute right-6 top-6 flex items-center gap-3">
        <span className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/30 backdrop-blur-sm">
          {Math.round(scale * 100)}%
        </span>
        <span className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/30 backdrop-blur-sm">
          {viewLabel}
        </span>
      </div>

      {/* Project legend — bottom left */}
      <div data-hud className="pointer-events-none absolute bottom-6 left-6 flex flex-col gap-2 rounded-xl bg-black/40 p-3 backdrop-blur-md">
        {MOCK_PROJECTS.map((p) => {
          const c = PROJECT_COLORS[p.id];
          return (
            <div key={p.id} className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c?.accent ?? "#666" }} />
              <span className="text-xs text-white/40">{p.name}</span>
            </div>
          );
        })}
      </div>

      {/* Hints — bottom right */}
      <div data-hud className="pointer-events-none absolute bottom-6 right-6 rounded-xl bg-black/40 p-3 backdrop-blur-md">
        <div className="flex flex-col gap-1 text-[10px] text-white/20">
          <span>Scroll to zoom</span>
          <span>Drag canvas to pan</span>
          <span>Drag card to reschedule</span>
          <span>Click card for details</span>
        </div>
      </div>
    </>
  );
}
