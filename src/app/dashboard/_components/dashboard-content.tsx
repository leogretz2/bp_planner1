// PROTOTYPE: Canvas + Terminal hybrid. Mock data, will connect to tRPC in production.
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
type CommandMode = "none" | "search" | "help";

interface DashboardContentProps {
  currentUser: unknown;
}

// ── Constants ────────────────────────────────────────────────────────────────

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

const STATUS_ICONS: Record<string, string> = {
  todo: "[ ]",
  in_progress: "[~]",
  done: "[x]",
  blocked: "[!]",
};

// ── Date helpers ─────────────────────────────────────────────────────────────

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

// ── Layout helper ────────────────────────────────────────────────────────────

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

  const backlogTasks = tasks.filter((t) => !t.due_date && !t.start_date);

  return { lanes, backlogTasks, todayLaneX };
}

// ── Build flat task list for keyboard nav ────────────────────────────────────

function buildFlatTaskList(
  lanes: { dateKey: string; tasks: MockTask[] }[],
  backlogTasks: MockTask[],
  searchQuery: string,
  selectedProjectId: string | null,
): MockTask[] {
  let allTasks: MockTask[] = [];

  // Collect tasks in spatial order (backlog first, then by lane/date)
  allTasks.push(...backlogTasks);
  for (const lane of lanes) {
    allTasks.push(...lane.tasks);
  }

  // Deduplicate (a task can appear in multiple lanes if start_date != due_date)
  const seen = new Set<string>();
  allTasks = allTasks.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  // Apply project filter
  if (selectedProjectId) {
    allTasks = allTasks.filter((t) => t.project_id === selectedProjectId);
  }

  // Apply search filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    allTasks = allTasks.filter((t) => t.title.toLowerCase().includes(q));
  }

  return allTasks;
}

// ── Main component ───────────────────────────────────────────────────────────

export function DashboardContent({
  currentUser: _currentUser,
}: DashboardContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Canvas state
  const [transform, setTransform] = useState<CanvasTransform>({
    x: 0,
    y: 0,
    scale: 1,
  });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [initialized, setInitialized] = useState(false);

  // Keyboard navigation state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [commandMode, setCommandMode] = useState<CommandMode>("none");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Data
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

  // Flat task list for keyboard navigation
  const flatTaskList = useMemo(
    () => buildFlatTaskList(lanes, backlogTasks, searchQuery, selectedProjectId),
    [lanes, backlogTasks, searchQuery, selectedProjectId],
  );

  const selectedTaskIndex = useMemo(() => {
    if (!selectedTaskId) return -1;
    return flatTaskList.findIndex((t) => t.id === selectedTaskId);
  }, [flatTaskList, selectedTaskId]);

  const selectedTask = selectedTaskId
    ? flatTaskList.find((t) => t.id === selectedTaskId) ?? null
    : null;

  // ── Center on today on mount ───────────────────────────────────────────

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

  // ── Pan handlers ───────────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-card]")) return;
      if ((e.target as HTMLElement).closest("[data-hud]")) return;
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

  // ── Zoom handler ───────────────────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
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
  }, []);

  // ── Keyboard navigation ────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // When searching, only handle escape/enter
      if (commandMode === "search") {
        if (e.key === "Escape") {
          e.preventDefault();
          setCommandMode("none");
          setSearchQuery("");
          searchInputRef.current?.blur();
        }
        return; // Let the input handle everything else
      }

      // Help overlay
      if (commandMode === "help") {
        if (e.key === "Escape" || e.key === "?") {
          e.preventDefault();
          setCommandMode("none");
        }
        return;
      }

      // ── Global shortcuts (commandMode === "none") ──

      // ? — help
      if (e.key === "?") {
        e.preventDefault();
        setCommandMode("help");
        return;
      }

      // / — search
      if (e.key === "/") {
        e.preventDefault();
        setCommandMode("search");
        setTimeout(() => searchInputRef.current?.focus(), 0);
        return;
      }

      // Escape — close expanded, clear selection, clear search
      if (e.key === "Escape") {
        e.preventDefault();
        if (expandedTaskId) {
          setExpandedTaskId(null);
        } else if (searchQuery) {
          setSearchQuery("");
        } else if (selectedTaskId) {
          setSelectedTaskId(null);
        }
        return;
      }

      // Ctrl+0 — reset view
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
        return;
      }

      // j/k or arrow down/up — navigate tasks
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        if (flatTaskList.length === 0) return;
        const nextIndex =
          selectedTaskIndex < 0
            ? 0
            : Math.min(selectedTaskIndex + 1, flatTaskList.length - 1);
        setSelectedTaskId(flatTaskList[nextIndex]!.id);
        return;
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        if (flatTaskList.length === 0) return;
        const prevIndex =
          selectedTaskIndex < 0
            ? flatTaskList.length - 1
            : Math.max(selectedTaskIndex - 1, 0);
        setSelectedTaskId(flatTaskList[prevIndex]!.id);
        return;
      }

      // Enter — expand/collapse selected task
      if (e.key === "Enter") {
        e.preventDefault();
        if (selectedTaskId) {
          setExpandedTaskId(
            expandedTaskId === selectedTaskId ? null : selectedTaskId,
          );
        }
        return;
      }

      // d — toggle done
      if (e.key === "d" && selectedTask) {
        e.preventDefault();
        const task = MOCK_TASKS.find((t) => t.id === selectedTask.id);
        if (task) {
          task.status = task.status === "done" ? "todo" : "done";
          // Force re-render
          setSelectedTaskId((id) => id);
        }
        return;
      }

      // 1/2/3 — project filter (cycle through projects)
      if (e.key === "1" || e.key === "2" || e.key === "3") {
        e.preventDefault();
        const projectIds = [null, ...MOCK_PROJECTS.map((p) => p.id)];
        const keyIndex = parseInt(e.key);
        if (keyIndex < projectIds.length) {
          setSelectedProjectId(projectIds[keyIndex] ?? null);
          setSelectedTaskId(null);
        }
        return;
      }

      // Tab — cycle project filter
      if (e.key === "Tab") {
        e.preventDefault();
        const projectIds = [null, ...MOCK_PROJECTS.map((p) => p.id)];
        const currentIdx = projectIds.indexOf(selectedProjectId);
        const nextIdx = (currentIdx + 1) % projectIds.length;
        setSelectedProjectId(projectIds[nextIdx] ?? null);
        setSelectedTaskId(null);
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    commandMode,
    expandedTaskId,
    searchQuery,
    selectedTaskId,
    selectedTask,
    selectedTaskIndex,
    flatTaskList,
    selectedProjectId,
    todayLaneX,
  ]);

  // ── Group tasks by project ─────────────────────────────────────────────

  const groupByProject = (tasks: MockTask[]) => {
    const groups: Record<string, MockTask[]> = {};
    tasks.forEach((t) => {
      if (!groups[t.project_id]) groups[t.project_id] = [];
      groups[t.project_id]!.push(t);
    });
    return groups;
  };

  // ── Render ─────────────────────────────────────────────────────────────

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
          selectedTaskId={selectedTaskId}
          onToggleExpand={setExpandedTaskId}
          onSelectTask={setSelectedTaskId}
          groupByProject={groupByProject}
          selectedProjectId={selectedProjectId}
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
            selectedTaskId={selectedTaskId}
            onToggleExpand={setExpandedTaskId}
            onSelectTask={setSelectedTaskId}
            groupByProject={groupByProject}
            selectedProjectId={selectedProjectId}
          />
        ))}
      </div>

      {/* HUD overlay — fixed, unaffected by transform */}
      <HUD
        viewMode={viewMode}
        scale={transform.scale}
        commandMode={commandMode}
        searchQuery={searchQuery}
        selectedProjectId={selectedProjectId}
        selectedTask={selectedTask}
        selectedTaskIndex={selectedTaskIndex}
        flatTaskListLength={flatTaskList.length}
        searchInputRef={searchInputRef}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => setCommandMode("none")}
        onSearchCancel={() => {
          setCommandMode("none");
          setSearchQuery("");
        }}
        onCloseHelp={() => setCommandMode("none")}
      />

      {/* Status bar — terminal-style, bottom of screen */}
      <StatusBar
        viewMode={viewMode}
        selectedProjectId={selectedProjectId}
        selectedTask={selectedTask}
        selectedTaskIndex={selectedTaskIndex}
        flatTaskListLength={flatTaskList.length}
        searchQuery={searchQuery}
        commandMode={commandMode}
      />
    </div>
  );
}

// ── Backlog Zone ─────────────────────────────────────────────────────────────

function BacklogZone({
  tasks,
  viewMode,
  expandedTaskId,
  selectedTaskId,
  onToggleExpand,
  onSelectTask,
  groupByProject,
  selectedProjectId,
}: {
  tasks: MockTask[];
  viewMode: ViewMode;
  expandedTaskId: string | null;
  selectedTaskId: string | null;
  onToggleExpand: (id: string | null) => void;
  onSelectTask: (id: string | null) => void;
  groupByProject: (tasks: MockTask[]) => Record<string, MockTask[]>;
  selectedProjectId: string | null;
}) {
  const filteredTasks = selectedProjectId
    ? tasks.filter((t) => t.project_id === selectedProjectId)
    : tasks;
  if (filteredTasks.length === 0) return null;
  const groups = groupByProject(filteredTasks);

  return (
    <div
      className="absolute"
      style={{ left: BACKLOG_X, top: 0, width: LANE_WIDTH }}
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="text-lg font-semibold tracking-wide text-white/40">
          BACKLOG
        </span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/30">
          {filteredTasks.length}
        </span>
      </div>

      <div className="absolute left-[-20px] top-0 h-[2000px] w-px bg-white/[0.04]" />

      <div style={{ paddingTop: LANE_TOP_PADDING }}>
        {Object.entries(groups).map(([projectId, projectTasks]) => (
          <ProjectCluster
            key={projectId}
            projectId={projectId}
            tasks={projectTasks}
            viewMode={viewMode}
            expandedTaskId={expandedTaskId}
            selectedTaskId={selectedTaskId}
            onToggleExpand={onToggleExpand}
            onSelectTask={onSelectTask}
          />
        ))}
      </div>
    </div>
  );
}

// ── Day Lane ─────────────────────────────────────────────────────────────────

function DayLane({
  date,
  dateKey: _dateKey,
  x,
  tasks,
  viewMode,
  expandedTaskId,
  selectedTaskId,
  onToggleExpand,
  onSelectTask,
  groupByProject,
  selectedProjectId,
}: {
  date: Date;
  dateKey: string;
  x: number;
  tasks: MockTask[];
  viewMode: ViewMode;
  expandedTaskId: string | null;
  selectedTaskId: string | null;
  onToggleExpand: (id: string | null) => void;
  onSelectTask: (id: string | null) => void;
  groupByProject: (tasks: MockTask[]) => Record<string, MockTask[]>;
  selectedProjectId: string | null;
}) {
  const today = isToday(date);
  const filteredTasks = selectedProjectId
    ? tasks.filter((t) => t.project_id === selectedProjectId)
    : tasks;
  const groups = groupByProject(filteredTasks);

  if (viewMode === "month") {
    return <MonthDayBlock date={date} x={x} tasks={filteredTasks} today={today} />;
  }

  return (
    <div
      className="absolute"
      style={{ left: x, top: 0, width: LANE_WIDTH }}
    >
      <div
        className="absolute left-[-20px] top-0 h-[2000px] w-px"
        style={{
          background: today
            ? "linear-gradient(180deg, rgba(99,102,241,0.5) 0%, rgba(99,102,241,0) 100%)"
            : "rgba(255,255,255,0.04)",
        }}
      />

      {today && (
        <div className="absolute left-0 top-0 h-1 w-full rounded-full bg-indigo-500/60 shadow-[0_0_20px_rgba(99,102,241,0.4)]" />
      )}

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
        {filteredTasks.length > 0 && (
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/30">
            {filteredTasks.length}
          </span>
        )}
      </div>

      <div style={{ paddingTop: LANE_TOP_PADDING }}>
        {Object.entries(groups).map(([projectId, projectTasks]) => (
          <ProjectCluster
            key={projectId}
            projectId={projectId}
            tasks={projectTasks}
            viewMode={viewMode}
            expandedTaskId={expandedTaskId}
            selectedTaskId={selectedTaskId}
            onToggleExpand={onToggleExpand}
            onSelectTask={onSelectTask}
          />
        ))}

        {filteredTasks.length === 0 && (
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-white/[0.06] text-xs text-white/15">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}

// ── Month Day Block ──────────────────────────────────────────────────────────

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
    <div className="absolute" style={{ left: x, top: 0, width: LANE_WIDTH }}>
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

// ── Project Cluster ──────────────────────────────────────────────────────────

function ProjectCluster({
  projectId,
  tasks,
  viewMode,
  expandedTaskId,
  selectedTaskId,
  onToggleExpand,
  onSelectTask,
}: {
  projectId: string;
  tasks: MockTask[];
  viewMode: ViewMode;
  expandedTaskId: string | null;
  selectedTaskId: string | null;
  onToggleExpand: (id: string | null) => void;
  onSelectTask: (id: string | null) => void;
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
      <div className="mb-2 flex items-center gap-2">
        <div
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: colors.accent }}
        />
        <span className="text-xs font-medium" style={{ color: colors.text }}>
          {project?.name ?? "Unknown"}
        </span>
      </div>

      <div className="flex flex-col" style={{ gap: CARD_GAP }}>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            colors={colors}
            viewMode={viewMode}
            isExpanded={expandedTaskId === task.id}
            isSelected={selectedTaskId === task.id}
            onToggle={() =>
              onToggleExpand(expandedTaskId === task.id ? null : task.id)
            }
            onSelect={() => onSelectTask(task.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  colors,
  viewMode,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
}: {
  task: MockTask;
  colors: { accent: string; glass: string; glow: string; text: string };
  viewMode: ViewMode;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const showDetail = viewMode === "detail" || isExpanded;

  return (
    <motion.div
      data-card
      layout
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
        onToggle();
      }}
      className="relative cursor-pointer select-none overflow-hidden rounded-xl border"
      style={{
        width: CARD_WIDTH,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        background: colors.glass,
        borderColor: isSelected
          ? colors.accent
          : "rgba(255,255,255,0.08)",
        boxShadow: isSelected
          ? `0 0 24px ${colors.glow}, 0 0 0 1px ${colors.accent}40, 0 4px 30px rgba(0,0,0,0.4)`
          : isExpanded
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
      {/* Selected indicator — left accent strip */}
      {isSelected && (
        <div
          className="absolute left-0 top-0 h-full w-0.5"
          style={{ backgroundColor: colors.accent }}
        />
      )}

      <div className="p-3">
        {/* Top row: status + title */}
        <div className="flex items-start gap-2">
          <span
            className="mt-1 h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: STATUS_DOTS[task.status] ?? "#666" }}
          />
          <span
            className={`text-sm font-medium leading-snug ${
              task.status === "done" ? "line-through opacity-50" : ""
            }`}
            style={{ color: colors.text }}
          >
            {task.title}
          </span>
        </div>

        {/* Hours + status badges */}
        <div className="mt-2 flex items-center gap-1">
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
          {/* Terminal-style status icon */}
          <span className="ml-auto font-mono text-[10px] text-white/20">
            {STATUS_ICONS[task.status]}
          </span>
        </div>

        {/* Expanded detail */}
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
              <div className="mt-2 font-mono text-[10px] leading-relaxed text-white/20">
                <div>
                  <span className="text-white/10">priority: </span>
                  <span>p{task.priority}</span>
                </div>
                <div>
                  <span className="text-white/10">status:   </span>
                  <span
                    style={{
                      color:
                        task.status === "blocked"
                          ? "#EF4444"
                          : task.status === "in_progress"
                            ? "#F59E0B"
                            : task.status === "done"
                              ? "#10B981"
                              : undefined,
                    }}
                  >
                    {task.status}
                  </span>
                </div>
                {task.due_date && (
                  <div>
                    <span className="text-white/10">due:      </span>
                    <span>{task.due_date}</span>
                  </div>
                )}
                {task.start_date && (
                  <div>
                    <span className="text-white/10">start:    </span>
                    <span>{task.start_date}</span>
                  </div>
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

// ── HUD Overlay ──────────────────────────────────────────────────────────────

function HUD({
  viewMode,
  scale,
  commandMode,
  searchQuery,
  selectedProjectId,
  selectedTask,
  selectedTaskIndex,
  flatTaskListLength,
  searchInputRef,
  onSearchChange,
  onSearchSubmit,
  onSearchCancel,
  onCloseHelp,
}: {
  viewMode: ViewMode;
  scale: number;
  commandMode: CommandMode;
  searchQuery: string;
  selectedProjectId: string | null;
  selectedTask: MockTask | null;
  selectedTaskIndex: number;
  flatTaskListLength: number;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onSearchChange: (q: string) => void;
  onSearchSubmit: () => void;
  onSearchCancel: () => void;
  onCloseHelp: () => void;
}) {
  const viewLabel =
    viewMode === "detail" ? "Detail" : viewMode === "month" ? "Month" : "Week";

  return (
    <>
      {/* Zoom + view — top right */}
      <div
        data-hud
        className="pointer-events-none absolute right-6 top-6 flex items-center gap-3"
      >
        <span className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/30 backdrop-blur-sm">
          {Math.round(scale * 100)}%
        </span>
        <span className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/30 backdrop-blur-sm">
          {viewLabel} view
        </span>
      </div>

      {/* Project filter — top left */}
      <div
        data-hud
        className="pointer-events-none absolute left-6 top-6 flex items-center gap-2"
      >
        {[{ id: null, name: "All" }, ...MOCK_PROJECTS].map((p, i) => {
          const isActive = selectedProjectId === p.id;
          const colors = p.id ? PROJECT_COLORS[p.id] : null;
          return (
            <span
              key={p.id ?? "all"}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium backdrop-blur-sm"
              style={{
                background: isActive
                  ? (colors?.glass ?? "rgba(255,255,255,0.08)")
                  : "rgba(255,255,255,0.02)",
                color: isActive
                  ? (colors?.text ?? "#FFF")
                  : "rgba(255,255,255,0.3)",
                borderWidth: 1,
                borderColor: isActive
                  ? (colors?.accent ?? "rgba(255,255,255,0.2)")
                  : "transparent",
              }}
            >
              {colors && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: colors.accent }}
                />
              )}
              {p.name}
              <span className="font-mono text-[10px] opacity-40">
                {i}
              </span>
            </span>
          );
        })}
      </div>

      {/* Search bar — top center */}
      {commandMode === "search" && (
        <div
          data-hud
          className="absolute left-1/2 top-6 -translate-x-1/2"
        >
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-4 py-2 backdrop-blur-md">
            <span className="font-mono text-sm text-white/30">/</span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSearchSubmit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  onSearchCancel();
                }
              }}
              className="w-64 border-none bg-transparent font-mono text-sm text-white/80 outline-none placeholder:text-white/20"
              placeholder="search tasks..."
              autoFocus
            />
            <span className="font-mono text-[10px] text-white/15">
              esc to close
            </span>
          </div>
        </div>
      )}

      {/* Active search indicator */}
      {commandMode !== "search" && searchQuery && (
        <div
          data-hud
          className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2"
        >
          <span className="rounded-lg bg-white/[0.04] px-3 py-1.5 font-mono text-xs text-white/30 backdrop-blur-sm">
            /{searchQuery}
            <span className="ml-2 text-white/15">
              {flatTaskListLength} results
            </span>
          </span>
        </div>
      )}

      {/* Selected task detail — bottom left panel */}
      <AnimatePresence>
        {selectedTask && (
          <motion.div
            data-hud
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-14 left-6 w-72 rounded-xl border border-white/[0.08] bg-black/60 p-4 backdrop-blur-md"
          >
            <div className="font-mono text-xs leading-relaxed">
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor:
                      PROJECT_COLORS[selectedTask.project_id]?.accent ?? "#666",
                  }}
                />
                <span className="text-white/60">
                  {MOCK_PROJECTS.find((p) => p.id === selectedTask.project_id)
                    ?.name ?? "Unknown"}
                </span>
                <span className="ml-auto text-white/20">
                  {selectedTaskIndex + 1}/{flatTaskListLength}
                </span>
              </div>
              <div className="mb-2 text-sm font-medium text-white/80">
                {selectedTask.title}
              </div>
              <div className="space-y-0.5 text-white/30">
                <div>
                  <span className="inline-block w-16 text-white/15">
                    status
                  </span>
                  <span
                    style={{
                      color: STATUS_DOTS[selectedTask.status] ?? "#666",
                    }}
                  >
                    {STATUS_ICONS[selectedTask.status]}{" "}
                    {selectedTask.status.replace("_", " ")}
                  </span>
                </div>
                <div>
                  <span className="inline-block w-16 text-white/15">
                    priority
                  </span>
                  p{selectedTask.priority}
                </div>
                {selectedTask.due_date && (
                  <div>
                    <span className="inline-block w-16 text-white/15">
                      due
                    </span>
                    {selectedTask.due_date}
                  </div>
                )}
                {selectedTask.estimated_hours && (
                  <div>
                    <span className="inline-block w-16 text-white/15">
                      est
                    </span>
                    {selectedTask.estimated_hours}h
                  </div>
                )}
              </div>
              {selectedTask.description && (
                <>
                  <div className="my-2 border-t border-white/5" />
                  <p className="text-white/25">{selectedTask.description}</p>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard hints — bottom right */}
      <div
        data-hud
        className="pointer-events-none absolute bottom-14 right-6 rounded-xl bg-black/40 p-3 backdrop-blur-md"
      >
        <div className="flex flex-col gap-1 font-mono text-[10px] text-white/20">
          <span>scroll → zoom</span>
          <span>drag  → pan</span>
          <span>j/k   → navigate tasks</span>
          <span>enter → expand/collapse</span>
          <span>d     → toggle done</span>
          <span>tab   → cycle projects</span>
          <span>/     → search</span>
          <span>?     → all shortcuts</span>
          <span>^0    → reset view</span>
        </div>
      </div>

      {/* Help overlay */}
      {commandMode === "help" && <HelpOverlay onClose={onCloseHelp} />}
    </>
  );
}

// ── Status Bar ───────────────────────────────────────────────────────────────

function StatusBar({
  viewMode,
  selectedProjectId,
  selectedTask,
  selectedTaskIndex,
  flatTaskListLength,
  searchQuery,
  commandMode,
}: {
  viewMode: ViewMode;
  selectedProjectId: string | null;
  selectedTask: MockTask | null;
  selectedTaskIndex: number;
  flatTaskListLength: number;
  searchQuery: string;
  commandMode: CommandMode;
}) {
  const projectName = selectedProjectId
    ? (MOCK_PROJECTS.find((p) => p.id === selectedProjectId)?.name ?? "Unknown")
    : "All";

  return (
    <div
      data-hud
      className="absolute bottom-0 left-0 right-0 flex items-center justify-between border-t border-white/[0.06] px-4 py-1.5 font-mono text-[11px]"
      style={{ background: "rgba(15, 15, 20, 0.9)", backdropFilter: "blur(8px)" }}
    >
      <div className="flex items-center gap-4">
        <span className="text-indigo-400">
          {viewMode.toUpperCase()}
        </span>
        <span className="text-white/10">|</span>
        <span className="text-white/30">
          {projectName}
        </span>
        <span className="text-white/10">|</span>
        <span className="text-white/30">
          {flatTaskListLength} tasks
        </span>
        {searchQuery && (
          <>
            <span className="text-white/10">|</span>
            <span className="text-white/30">/{searchQuery}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-4">
        {selectedTask && (
          <span className="text-white/30">
            [{selectedTaskIndex + 1}/{flatTaskListLength}]{" "}
            <span style={{ color: STATUS_DOTS[selectedTask.status] }}>
              {STATUS_ICONS[selectedTask.status]}
            </span>{" "}
            {selectedTask.title.length > 30
              ? selectedTask.title.slice(0, 30) + "..."
              : selectedTask.title}
          </span>
        )}
        <span className="text-white/15">
          {commandMode === "search"
            ? "SEARCH"
            : commandMode === "help"
              ? "HELP"
              : "NORMAL"}
        </span>
      </div>
    </div>
  );
}

// ── Help Overlay ─────────────────────────────────────────────────────────────

function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.8)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="rounded-2xl border border-white/10 bg-[#0F0F14] p-8"
        style={{ maxWidth: "500px", width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 text-lg font-semibold text-white/80">
          Keyboard Shortcuts
        </div>
        <div className="space-y-1 font-mono text-sm">
          {[
            ["j / k / ↑ / ↓", "Navigate tasks"],
            ["Enter", "Expand / collapse task"],
            ["d", "Toggle done status"],
            ["Tab", "Cycle project filter"],
            ["1 / 2 / 3", "Filter by project (0 = all)"],
            ["/", "Search tasks"],
            ["Esc", "Close / clear / deselect"],
            ["Ctrl+0", "Reset canvas view"],
            ["Scroll", "Zoom in / out"],
            ["Drag", "Pan canvas"],
            ["?", "Toggle this help"],
          ].map(([key, desc]) => (
            <div key={key} className="flex items-center">
              <span className="inline-block w-40 text-indigo-400/70">
                {key}
              </span>
              <span className="text-white/40">{desc}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 text-xs text-white/15">
          Press ? or Esc to close
        </div>
      </motion.div>
    </div>
  );
}
