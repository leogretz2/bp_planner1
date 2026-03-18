// PROTOTYPE: Using mock data. Will connect to tRPC in production.
"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MOCK_TASKS,
  MOCK_PROJECTS,
  PROJECT_COLORS,
  type MockTask,
} from "./mock-data";

// ---------- types ----------

interface CanvasTransform {
  x: number;
  y: number;
  scale: number;
}

type ViewMode = "detail" | "week" | "month";

interface DashboardContentProps {
  currentUser: unknown;
}

// ---------- constants ----------

const LANE_WIDTH = 400;
const LANE_GAP = 40;
const CARD_WIDTH = 200;
const CARD_GAP = 12;
const LANE_TOP_PADDING = 80;
const BACKLOG_X = -600;
const MIN_SCALE = 0.2;
const MAX_SCALE = 3;

const STATUS_DOTS: Record<string, string> = {
  todo: "#6B7280",
  in_progress: "#F59E0B",
  done: "#10B981",
  blocked: "#EF4444",
};

// ---------- date helpers ----------

function getWeekDates(weeksAround: number = 4) {
  const today = new Date();
  const currentDay = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));

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

function formatDateKey(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayLabel(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
}

function formatMonthDay(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isToday(d: Date) {
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// ---------- layout helper ----------

function buildLaneLayout(dates: Date[], tasks: typeof MOCK_TASKS) {
  const lanes: {
    date: Date;
    dateKey: string;
    x: number;
    tasks: typeof MOCK_TASKS;
  }[] = [];

  const todayKey = formatDateKey(new Date());
  let todayLaneX = 0;

  dates.forEach((date, i) => {
    const dateKey = formatDateKey(date);
    const x = i * (LANE_WIDTH + LANE_GAP);
    const laneTasks = tasks.filter(
      (t) => t.due_date === dateKey || t.start_date === dateKey,
    );
    lanes.push({ date, dateKey, x, tasks: laneTasks });
    if (dateKey === todayKey) todayLaneX = x;
  });

  const backlogTasks = tasks.filter(
    (t) => !t.due_date && !t.start_date,
  );

  return { lanes, backlogTasks, todayLaneX };
}

// ---------- main component ----------

export function DashboardContent({ currentUser: _currentUser }: DashboardContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<CanvasTransform>({
    x: 0,
    y: 0,
    scale: 1,
  });
  const [isPanning, setIsPanning] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const panStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [initialized, setInitialized] = useState(false);

  const dates = useMemo(() => getWeekDates(4), []);
  const { lanes, backlogTasks, todayLaneX } = useMemo(
    () => buildLaneLayout(dates, MOCK_TASKS),
    [dates],
  );

  const viewMode: ViewMode = useMemo(() => {
    if (transform.scale > 1.5) return "detail";
    if (transform.scale < 0.7) return "month";
    return "week";
  }, [transform.scale]);

  // Center on today on mount
  useEffect(() => {
    if (initialized) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setTransform({
      x: -todayLaneX + rect.width / 2 - LANE_WIDTH / 2,
      y: 40,
      scale: 1,
    });
    setInitialized(true);
  }, [todayLaneX, initialized]);

  // --- pan handlers ---
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only pan from empty canvas (not cards)
      if ((e.target as HTMLElement).closest("[data-card]")) return;
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        tx: transform.x,
        ty: transform.y,
      };
    },
    [transform.x, transform.y],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setTransform((prev) => ({
        ...prev,
        x: panStartRef.current.tx + dx,
        y: panStartRef.current.ty + dy,
      }));
    },
    [isPanning],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // --- zoom handler ---
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;

      setTransform((prev) => {
        const newScale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, prev.scale * zoomFactor),
        );
        const scaleRatio = newScale / prev.scale;
        return {
          scale: newScale,
          x: cursorX - (cursorX - prev.x) * scaleRatio,
          y: cursorY - (cursorY - prev.y) * scaleRatio,
        };
      });
    },
    [],
  );

  // --- keyboard nav ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "0" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        setTransform({
          x: -todayLaneX + rect.width / 2 - LANE_WIDTH / 2,
          y: 40,
          scale: 1,
        });
      }
      if (e.key === "Escape") {
        setExpandedTaskId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [todayLaneX]);

  // --- group tasks by project for rendering ---
  const groupByProject = (tasks: MockTask[]) => {
    const groups: Record<string, MockTask[]> = {};
    tasks.forEach((t) => {
      if (!groups[t.project_id]) groups[t.project_id] = [];
      groups[t.project_id]!.push(t);
    });
    return groups;
  };

  return (
    <div
      ref={containerRef}
      className="canvas-bg relative h-full w-full overflow-hidden"
      style={{ cursor: isPanning ? "grabbing" : "grab" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Transform layer */}
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          willChange: "transform",
        }}
      >
        {/* Backlog zone */}
        <BacklogZone
          tasks={backlogTasks}
          viewMode={viewMode}
          expandedTaskId={expandedTaskId}
          onToggleExpand={setExpandedTaskId}
          groupByProject={groupByProject}
        />

        {/* Day lanes */}
        {lanes.map((lane) => (
          <DayLane
            key={lane.dateKey}
            date={lane.date}
            dateKey={lane.dateKey}
            x={lane.x}
            tasks={lane.tasks}
            viewMode={viewMode}
            expandedTaskId={expandedTaskId}
            onToggleExpand={setExpandedTaskId}
            groupByProject={groupByProject}
          />
        ))}
      </div>

      {/* HUD overlay — fixed, unaffected by transform */}
      <HUD
        viewMode={viewMode}
        scale={transform.scale}
      />
    </div>
  );
}

// ---------- Backlog Zone ----------

function BacklogZone({
  tasks,
  viewMode,
  expandedTaskId,
  onToggleExpand,
  groupByProject,
}: {
  tasks: MockTask[];
  viewMode: ViewMode;
  expandedTaskId: string | null;
  onToggleExpand: (id: string | null) => void;
  groupByProject: (tasks: MockTask[]) => Record<string, MockTask[]>;
}) {
  if (tasks.length === 0) return null;
  const groups = groupByProject(tasks);

  return (
    <div
      className="absolute"
      style={{ left: BACKLOG_X, top: 0, width: LANE_WIDTH }}
    >
      {/* Lane label */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-lg font-semibold text-white/40 tracking-wide">
          BACKLOG
        </span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/30">
          {tasks.length}
        </span>
      </div>

      {/* Subtle lane divider */}
      <div className="absolute left-[-20px] top-0 h-[2000px] w-px bg-white/[0.04]" />

      <div style={{ paddingTop: LANE_TOP_PADDING }}>
        {Object.entries(groups).map(([projectId, projectTasks]) => (
          <ProjectCluster
            key={projectId}
            projectId={projectId}
            tasks={projectTasks}
            viewMode={viewMode}
            expandedTaskId={expandedTaskId}
            onToggleExpand={onToggleExpand}
          />
        ))}
      </div>
    </div>
  );
}

// ---------- Day Lane ----------

function DayLane({
  date,
  dateKey: _dateKey,
  x,
  tasks,
  viewMode,
  expandedTaskId,
  onToggleExpand,
  groupByProject,
}: {
  date: Date;
  dateKey: string;
  x: number;
  tasks: MockTask[];
  viewMode: ViewMode;
  expandedTaskId: string | null;
  onToggleExpand: (id: string | null) => void;
  groupByProject: (tasks: MockTask[]) => Record<string, MockTask[]>;
}) {
  const today = isToday(date);
  const groups = groupByProject(tasks);

  if (viewMode === "month") {
    return (
      <MonthDayBlock date={date} x={x} tasks={tasks} today={today} />
    );
  }

  return (
    <div
      className="absolute"
      style={{ left: x, top: 0, width: LANE_WIDTH }}
    >
      {/* Lane divider */}
      <div
        className="absolute left-[-20px] top-0 h-[2000px] w-px"
        style={{
          background: today
            ? "linear-gradient(180deg, rgba(99,102,241,0.5) 0%, rgba(99,102,241,0) 100%)"
            : "rgba(255,255,255,0.04)",
        }}
      />

      {/* Today glow line */}
      {today && (
        <div className="absolute left-0 top-0 h-1 w-full rounded-full bg-indigo-500/60 shadow-[0_0_20px_rgba(99,102,241,0.4)]" />
      )}

      {/* Day label */}
      <div className="mb-2 flex items-center gap-3">
        <span
          className={`text-lg font-semibold tracking-wide ${
            today ? "text-indigo-400" : "text-white/40"
          }`}
        >
          {formatDayLabel(date)}
        </span>
        <span className="text-xs text-white/20">{formatMonthDay(date)}</span>
        {today && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
          </span>
        )}
        {tasks.length > 0 && (
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/30">
            {tasks.length}
          </span>
        )}
      </div>

      {/* Project clusters */}
      <div style={{ paddingTop: LANE_TOP_PADDING }}>
        {Object.entries(groups).map(([projectId, projectTasks]) => (
          <ProjectCluster
            key={projectId}
            projectId={projectId}
            tasks={projectTasks}
            viewMode={viewMode}
            expandedTaskId={expandedTaskId}
            onToggleExpand={onToggleExpand}
          />
        ))}

        {tasks.length === 0 && (
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-white/[0.06] text-xs text-white/15">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Month Day Block (zoomed-out summary) ----------

function MonthDayBlock({
  date,
  x,
  tasks,
  today,
}: {
  date: Date;
  x: number;
  tasks: MockTask[];
  today: boolean;
}) {
  const projectCounts: Record<string, number> = {};
  tasks.forEach((t) => {
    projectCounts[t.project_id] = (projectCounts[t.project_id] ?? 0) + 1;
  });

  return (
    <div
      className="absolute"
      style={{ left: x, top: 0, width: LANE_WIDTH }}
    >
      <div
        className={`rounded-xl border p-4 ${
          today
            ? "border-indigo-500/30 bg-indigo-500/[0.06]"
            : "border-white/[0.06] bg-white/[0.02]"
        }`}
        style={{ minHeight: 80 }}
      >
        <div className="mb-2 text-sm font-medium text-white/50">
          {formatMonthDay(date)}
        </div>
        {Object.entries(projectCounts).map(([pid, count]) => {
          const colors = PROJECT_COLORS[pid];
          return (
            <div key={pid} className="mb-1 flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: colors?.accent ?? "#666" }}
              />
              <span className="text-xs text-white/40">
                {MOCK_PROJECTS.find((p) => p.id === pid)?.name} — {count}
              </span>
            </div>
          );
        })}
        {tasks.length === 0 && (
          <span className="text-xs text-white/15">empty</span>
        )}
      </div>
    </div>
  );
}

// ---------- Project Cluster ----------

function ProjectCluster({
  projectId,
  tasks,
  viewMode,
  expandedTaskId,
  onToggleExpand,
}: {
  projectId: string;
  tasks: MockTask[];
  viewMode: ViewMode;
  expandedTaskId: string | null;
  onToggleExpand: (id: string | null) => void;
}) {
  const project = MOCK_PROJECTS.find((p) => p.id === projectId);
  const colors = PROJECT_COLORS[projectId] ?? {
    accent: "#666",
    glass: "rgba(102,102,102,0.12)",
    glow: "rgba(102,102,102,0.3)",
    text: "#999",
  };

  return (
    <div className="mb-6">
      {/* Project label */}
      <div className="mb-2 flex items-center gap-2">
        <div
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: colors.accent }}
        />
        <span className="text-xs font-medium" style={{ color: colors.text }}>
          {project?.name ?? "Unknown"}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col" style={{ gap: CARD_GAP }}>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            colors={colors}
            viewMode={viewMode}
            isExpanded={expandedTaskId === task.id}
            onToggle={() =>
              onToggleExpand(expandedTaskId === task.id ? null : task.id)
            }
          />
        ))}
      </div>
    </div>
  );
}

// ---------- Task Card ----------

function TaskCard({
  task,
  colors,
  viewMode,
  isExpanded,
  onToggle,
}: {
  task: MockTask;
  colors: { accent: string; glass: string; glow: string; text: string };
  viewMode: ViewMode;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const showDetail = viewMode === "detail" || isExpanded;

  return (
    <motion.div
      data-card
      layout
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="relative cursor-pointer select-none overflow-hidden rounded-xl border"
      style={{
        width: CARD_WIDTH,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        background: colors.glass,
        borderColor: "rgba(255,255,255,0.08)",
        boxShadow: isExpanded
          ? `0 0 24px ${colors.glow}, 0 4px 30px rgba(0,0,0,0.4)`
          : `0 0 12px ${colors.glow.replace("0.3", "0.1")}, 0 2px 12px rgba(0,0,0,0.3)`,
      }}
      whileHover={{
        boxShadow: `0 0 20px ${colors.glow}, 0 4px 24px rgba(0,0,0,0.4)`,
        scale: 1.02,
        transition: { duration: 0.2 },
      }}
      transition={{ layout: { duration: 0.25, ease: "easeOut" } }}
    >
      <div className="p-3">
        {/* Top row: status dot + title */}
        <div className="flex items-start gap-2">
          <span
            className="mt-1 h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: STATUS_DOTS[task.status] ?? "#666" }}
          />
          <span
            className="text-sm font-medium leading-snug"
            style={{ color: colors.text }}
          >
            {task.title}
          </span>
        </div>

        {/* Hours badge */}
        {task.estimated_hours && (
          <div className="mt-2 flex items-center gap-1">
            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-white/30">
              {task.estimated_hours}h
            </span>
            {task.status === "blocked" && (
              <span className="rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400/60">
                blocked
              </span>
            )}
          </div>
        )}

        {/* Detail view: description + status + priority */}
        <AnimatePresence>
          {showDetail && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {task.description && (
                <p className="mt-2 text-xs leading-relaxed text-white/25">
                  {task.description}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2 text-[10px] text-white/20">
                <span>
                  Priority {task.priority}
                </span>
                <span className="text-white/10">|</span>
                <span className="capitalize">
                  {task.status.replace("_", " ")}
                </span>
                {task.due_date && (
                  <>
                    <span className="text-white/10">|</span>
                    <span>Due {task.due_date}</span>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom accent bar */}
      <div
        className="h-0.5 w-full"
        style={{
          background: `linear-gradient(90deg, ${colors.accent}40 0%, transparent 100%)`,
        }}
      />
    </motion.div>
  );
}

// ---------- HUD Overlay ----------

function HUD({
  viewMode,
  scale,
}: {
  viewMode: ViewMode;
  scale: number;
}) {
  const viewLabel =
    viewMode === "detail"
      ? "Detail"
      : viewMode === "month"
        ? "Month"
        : "Week";

  return (
    <>
      {/* Zoom indicator — top right */}
      <div className="pointer-events-none absolute right-6 top-6 flex items-center gap-3">
        <span className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/30 backdrop-blur-sm">
          {Math.round(scale * 100)}%
        </span>
        <span className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/30 backdrop-blur-sm">
          {viewLabel} view
        </span>
      </div>

      {/* Project legend — bottom left */}
      <div className="pointer-events-none absolute bottom-6 left-6 flex flex-col gap-2 rounded-xl bg-black/40 p-3 backdrop-blur-md">
        {MOCK_PROJECTS.map((p) => {
          const colors = PROJECT_COLORS[p.id];
          return (
            <div key={p.id} className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: colors?.accent ?? "#666" }}
              />
              <span className="text-xs text-white/40">{p.name}</span>
            </div>
          );
        })}
      </div>

      {/* Keyboard hint — bottom right */}
      <div className="pointer-events-none absolute bottom-6 right-6 rounded-xl bg-black/40 p-3 backdrop-blur-md">
        <div className="flex flex-col gap-1 text-[10px] text-white/20">
          <span>Scroll to zoom</span>
          <span>Drag to pan</span>
          <span>Click card to expand</span>
          <span>Ctrl+0 reset view</span>
          <span>Esc close detail</span>
        </div>
      </div>

      {/* Minimap — bottom center-right */}
      <Minimap />
    </>
  );
}

// ---------- Minimap ----------

function Minimap() {
  // Simple static minimap showing the overall canvas extent
  // In a real build this would reflect actual viewport position
  return (
    <div className="pointer-events-none absolute bottom-6 right-40 h-16 w-28 rounded-lg border border-white/[0.06] bg-black/40 backdrop-blur-md">
      {/* Dots representing day lanes */}
      <div className="flex h-full items-center justify-center gap-1 px-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className={`h-6 w-1 rounded-full ${
              i === 2 ? "bg-indigo-500/40" : "bg-white/[0.08]"
            }`}
          />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0.5 text-center text-[8px] text-white/15">
        minimap
      </div>
    </div>
  );
}
