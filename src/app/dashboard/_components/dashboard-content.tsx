"use client";

// PROTOTYPE: Using mock data. Will connect to tRPC in production.

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MOCK_TASKS,
  MOCK_PROJECTS,
  PROJECT_COLORS,
  type MockTask,
} from "./mock-data";

type Scope = "day" | "week" | "month";

interface DashboardContentProps {
  currentUser: {
    id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
    role: string;
  };
}

// ─── Date utilities ─────────────────────────────────────────────────────────

const today = new Date();
const todayStr = formatDateKey(today);

function formatDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function startOfWeek(d: Date) {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1)); // Monday start
  return r;
}

function formatEditorialDate(d: Date) {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  return `${dayNames[d.getDay()]}, ${monthNames[d.getMonth()]} ${d.getDate()}`;
}

function formatShortDate(d: Date) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${dayNames[d.getDay()]}, ${monthNames[d.getMonth()]} ${d.getDate()}`;
}

function getRelativeLabel(d: Date): string | null {
  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, addDays(today, -1))) return "Yesterday";
  if (isSameDay(d, addDays(today, 1))) return "Tomorrow";
  return null;
}

function getWeekLabel(d: Date): string {
  const start = startOfWeek(d);
  const end = addDays(start, 6);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (start.getMonth() === end.getMonth()) {
    return `${monthNames[start.getMonth()]} ${start.getDate()} – ${end.getDate()}`;
  }
  return `${monthNames[start.getMonth()]} ${start.getDate()} – ${monthNames[end.getMonth()]} ${end.getDate()}`;
}

// ─── Data helpers ───────────────────────────────────────────────────────────

function getTasksForDate(tasks: MockTask[], dateStr: string): MockTask[] {
  return tasks.filter(t => t.due_date === dateStr || t.start_date === dateStr);
}

function groupTasksByDate(tasks: MockTask[]): Map<string, MockTask[]> {
  const map = new Map<string, MockTask[]>();
  tasks.forEach(t => {
    const dates = new Set<string>();
    if (t.due_date) dates.add(t.due_date);
    if (t.start_date) dates.add(t.start_date);
    if (dates.size === 0 && !t.due_date && !t.start_date) {
      // Undated tasks go to "someday"
      const key = "__someday__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
      return;
    }
    dates.forEach(dateStr => {
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr)!.push(t);
    });
  });
  return map;
}

function getDateRange(): string[] {
  // Show from 4 days ago to 30 days in the future
  const dates: string[] = [];
  for (let i = -4; i <= 30; i++) {
    dates.push(formatDateKey(addDays(today, i)));
  }
  return dates;
}

function getWeekRanges(): { label: string; start: string; end: string; dates: string[] }[] {
  const weeks: { label: string; start: string; end: string; dates: string[] }[] = [];
  let current = startOfWeek(addDays(today, -4));
  const endDate = addDays(today, 30);

  while (current <= endDate) {
    const weekStart = new Date(current);
    const weekEnd = addDays(weekStart, 6);
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      dates.push(formatDateKey(addDays(weekStart, i)));
    }
    weeks.push({
      label: getWeekLabel(weekStart),
      start: formatDateKey(weekStart),
      end: formatDateKey(weekEnd),
      dates,
    });
    current = addDays(current, 7);
  }
  return weeks;
}

// ─── Components ─────────────────────────────────────────────────────────────

function ScopeSelector({ scope, onChange }: { scope: Scope; onChange: (s: Scope) => void }) {
  const scopes: { key: Scope; label: string; shortcut: string }[] = [
    { key: "day", label: "Day", shortcut: "1" },
    { key: "week", label: "Week", shortcut: "2" },
    { key: "month", label: "Month", shortcut: "3" },
  ];

  return (
    <div className="flex items-center gap-1 rounded-lg bg-stone-100 p-1">
      {scopes.map(s => (
        <button
          key={s.key}
          onClick={() => onChange(s.key)}
          className={`relative rounded-md px-4 py-1.5 text-sm transition-colors ${
            scope === s.key
              ? "text-stone-900"
              : "text-stone-400 hover:text-stone-600"
          }`}
        >
          {scope === s.key && (
            <motion.div
              layoutId="scope-pill"
              className="absolute inset-0 rounded-md bg-white shadow-sm"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5">
            {s.label}
            <kbd className="hidden text-[10px] text-stone-300 sm:inline">
              {s.shortcut}
            </kbd>
          </span>
        </button>
      ))}
    </div>
  );
}

function ProjectRail({
  selectedProject,
  onSelect,
}: {
  selectedProject: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      <button
        onClick={() => onSelect(null)}
        className={`shrink-0 rounded-full px-4 py-1.5 text-sm transition-colors ${
          selectedProject === null
            ? "bg-stone-800 text-white"
            : "bg-stone-100 text-stone-500 hover:bg-stone-200"
        }`}
      >
        All projects
      </button>
      {MOCK_PROJECTS.map(p => {
        const colors = PROJECT_COLORS[p.id];
        const isActive = selectedProject === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(isActive ? null : p.id)}
            className="shrink-0 rounded-full px-4 py-1.5 text-sm transition-colors"
            style={{
              backgroundColor: isActive ? colors?.accent : colors?.bg,
              color: isActive ? "#fff" : colors?.text,
              borderWidth: "1px",
              borderColor: colors?.border,
            }}
          >
            {p.name}
          </button>
        );
      })}
    </div>
  );
}

function TaskEntry({
  task,
  expanded,
  onToggle,
}: {
  task: MockTask;
  expanded: boolean;
  onToggle: () => void;
}) {
  const colors = PROJECT_COLORS[task.project_id];
  const project = MOCK_PROJECTS.find(p => p.id === task.project_id);

  const statusClasses = {
    done: "line-through opacity-40",
    in_progress: "font-semibold",
    blocked: "italic",
    todo: "",
  };

  return (
    <motion.div
      layout
      className="group relative cursor-pointer border-b border-stone-100 py-3 pl-4 pr-2 last:border-b-0"
      onClick={onToggle}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      {/* Project spine */}
      <div
        className="absolute left-0 top-0 h-full w-[3px] rounded-full"
        style={{ backgroundColor: colors?.border ?? "#ddd" }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="flex items-center gap-2">
            {task.status === "in_progress" && (
              <div
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: colors?.accent ?? "#333" }}
              />
            )}
            <span
              className={`text-[15px] leading-snug text-stone-800 ${statusClasses[task.status]}`}
            >
              {task.title}
            </span>
            {task.status === "blocked" && (
              <span className="shrink-0 text-[11px] font-medium tracking-wide text-stone-400 uppercase">
                blocked
              </span>
            )}
          </div>

          {/* Meta line */}
          <div className="mt-0.5 flex items-center gap-2 text-[12px] text-stone-400">
            <span style={{ color: colors?.text }}>{project?.name}</span>
            {task.estimated_hours && (
              <>
                <span className="text-stone-200">·</span>
                <span>{task.estimated_hours}h</span>
              </>
            )}
            {task.priority <= 2 && (
              <>
                <span className="text-stone-200">·</span>
                <span className="text-stone-500">P{task.priority}</span>
              </>
            )}
          </div>
        </div>

        {/* Expand indicator */}
        <motion.span
          className="mt-1 text-stone-300 text-xs"
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          &#9662;
        </motion.span>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
              {task.description && (
                <p className="text-[13px] leading-relaxed text-stone-500">
                  {task.description}
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-stone-400">
                {task.due_date && (
                  <span>Due: {task.due_date}</span>
                )}
                {task.start_date && (
                  <span>Started: {task.start_date}</span>
                )}
                {task.estimated_hours && (
                  <span>Estimate: {task.estimated_hours}h</span>
                )}
                <span className="capitalize">
                  Status: {task.status.replace("_", " ")}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DateSection({
  dateStr,
  tasks,
  isToday,
  isPast,
  expandedTaskId,
  onToggleTask,
  scope,
}: {
  dateStr: string;
  tasks: MockTask[];
  isToday: boolean;
  isPast: boolean;
  expandedTaskId: string | null;
  onToggleTask: (id: string) => void;
  scope: Scope;
}) {
  const d = new Date(dateStr + "T12:00:00");
  const relative = getRelativeLabel(d);
  const fullDate = scope === "day" ? formatEditorialDate(d) : formatShortDate(d);

  if (tasks.length === 0 && scope !== "day") return null;

  return (
    <motion.section
      layout
      className={`relative ${isPast && !isToday ? "opacity-50" : ""}`}
    >
      {/* Date header */}
      <div
        className={`sticky top-0 z-10 px-1 py-3 ${
          isToday
            ? "bg-amber-50/80 backdrop-blur-sm"
            : "bg-[#FAFAF7]/80 backdrop-blur-sm"
        }`}
      >
        <div className="flex items-baseline gap-3">
          <h2
            className={`font-serif tracking-tight ${
              scope === "day" ? "text-3xl" : "text-xl"
            } ${isToday ? "text-stone-900" : "text-stone-600"}`}
          >
            {relative ?? fullDate}
          </h2>
          {relative && (
            <span className="text-sm text-stone-400">{fullDate}</span>
          )}
          {isToday && (
            <span className="text-[11px] font-medium tracking-widest text-amber-600 uppercase">
              now
            </span>
          )}
        </div>
        {scope === "day" && (
          <div className="mt-1 text-[13px] text-stone-400">
            {tasks.length} {tasks.length === 1 ? "entry" : "entries"}
          </div>
        )}
      </div>

      {/* Task entries */}
      {tasks.length > 0 ? (
        <div
          className={`rounded-lg ${isToday ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]" : ""}`}
        >
          {tasks.map(task => (
            <TaskEntry
              key={task.id}
              task={task}
              expanded={expandedTaskId === task.id}
              onToggle={() => onToggleTask(task.id)}
            />
          ))}
        </div>
      ) : scope === "day" ? (
        <div className="py-6 text-center text-sm italic text-stone-300">
          Nothing scheduled
        </div>
      ) : null}
    </motion.section>
  );
}

function WeekSection({
  label,
  dates,
  tasksByDate,
  expandedTaskId,
  onToggleTask,
  isCurrent,
}: {
  label: string;
  dates: string[];
  tasksByDate: Map<string, MockTask[]>;
  expandedTaskId: string | null;
  onToggleTask: (id: string) => void;
  isCurrent: boolean;
}) {
  const totalTasks = dates.reduce((sum, d) => sum + (tasksByDate.get(d)?.length ?? 0), 0);
  const doneCount = dates.reduce(
    (sum, d) => sum + (tasksByDate.get(d)?.filter(t => t.status === "done").length ?? 0),
    0,
  );

  if (totalTasks === 0) return null;

  return (
    <motion.section layout className="space-y-2">
      {/* Week header */}
      <div
        className={`sticky top-0 z-10 flex items-baseline justify-between px-1 py-3 ${
          isCurrent ? "bg-amber-50/80" : "bg-[#FAFAF7]/80"
        } backdrop-blur-sm`}
      >
        <h2 className="font-serif text-xl tracking-tight text-stone-700">
          {label}
          {isCurrent && (
            <span className="ml-3 text-[11px] font-medium tracking-widest text-amber-600 uppercase font-sans">
              this week
            </span>
          )}
        </h2>
        <span className="text-[13px] text-stone-400">
          {doneCount}/{totalTasks} done
        </span>
      </div>

      {/* Day sub-sections */}
      {dates.map(dateStr => {
        const tasks = tasksByDate.get(dateStr) ?? [];
        if (tasks.length === 0) return null;
        const d = new Date(dateStr + "T12:00:00");
        const isToday = dateStr === todayStr;
        const isPast = dateStr < todayStr;
        return (
          <DateSection
            key={dateStr}
            dateStr={dateStr}
            tasks={tasks}
            isToday={isToday}
            isPast={isPast}
            expandedTaskId={expandedTaskId}
            onToggleTask={onToggleTask}
            scope="week"
          />
        );
      })}
    </motion.section>
  );
}

function MonthOverview({
  weekRanges,
  tasksByDate,
}: {
  weekRanges: { label: string; start: string; end: string; dates: string[] }[];
  tasksByDate: Map<string, MockTask[]>;
}) {
  return (
    <div className="space-y-4">
      {weekRanges.map(week => {
        const tasks = week.dates.flatMap(d => tasksByDate.get(d) ?? []);
        // Deduplicate tasks that appear on multiple days
        const uniqueTasks = [...new Map(tasks.map(t => [t.id, t])).values()];
        if (uniqueTasks.length === 0) return null;

        const isCurrentWeek = week.dates.includes(todayStr);
        const doneCount = uniqueTasks.filter(t => t.status === "done").length;
        const inProgressCount = uniqueTasks.filter(t => t.status === "in_progress").length;
        const topItems = uniqueTasks
          .filter(t => t.priority <= 2 && t.status !== "done")
          .slice(0, 3);

        return (
          <motion.div
            key={week.start}
            layout
            className={`rounded-lg border px-5 py-4 ${
              isCurrentWeek
                ? "border-amber-200 bg-amber-50/50"
                : "border-stone-100 bg-white"
            }`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="font-serif text-lg text-stone-700">
                {week.label}
                {isCurrentWeek && (
                  <span className="ml-2 text-[11px] font-medium tracking-widest text-amber-600 uppercase font-sans">
                    current
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-3 text-[13px] text-stone-400">
                {inProgressCount > 0 && (
                  <span>{inProgressCount} active</span>
                )}
                <span>
                  {doneCount}/{uniqueTasks.length}
                </span>
              </div>
            </div>

            {topItems.length > 0 && (
              <div className="mt-2 space-y-1">
                {topItems.map(task => {
                  const colors = PROJECT_COLORS[task.project_id];
                  return (
                    <div key={task.id} className="flex items-center gap-2 text-[13px]">
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: colors?.border }}
                      />
                      <span className="text-stone-600">{task.title}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function SomedaySection({
  tasks,
  expandedTaskId,
  onToggleTask,
}: {
  tasks: MockTask[];
  expandedTaskId: string | null;
  onToggleTask: (id: string) => void;
}) {
  if (tasks.length === 0) return null;

  return (
    <motion.section layout className="mt-8 border-t border-dashed border-stone-200 pt-6">
      <h2 className="mb-3 font-serif text-xl tracking-tight text-stone-400">
        Someday
      </h2>
      <div className="rounded-lg">
        {tasks.map(task => (
          <TaskEntry
            key={task.id}
            task={task}
            expanded={expandedTaskId === task.id}
            onToggle={() => onToggleTask(task.id)}
          />
        ))}
      </div>
    </motion.section>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function DashboardContent({ currentUser: _currentUser }: DashboardContentProps) {
  const [scope, setScope] = useState<Scope>("week");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Filter tasks by project
  const tasks = useMemo(() => {
    if (!selectedProject) return MOCK_TASKS;
    return MOCK_TASKS.filter(t => t.project_id === selectedProject);
  }, [selectedProject]);

  const tasksByDate = useMemo(() => groupTasksByDate(tasks), [tasks]);
  const dateRange = useMemo(() => getDateRange(), []);
  const weekRanges = useMemo(() => getWeekRanges(), []);
  const somedayTasks = useMemo(() => tasksByDate.get("__someday__") ?? [], [tasksByDate]);

  const handleToggleTask = useCallback((id: string) => {
    setExpandedTaskId(prev => (prev === id ? null : id));
  }, []);

  // Keyboard shortcuts for scope switching
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "1") { e.preventDefault(); setScope("day"); }
        if (e.key === "2") { e.preventDefault(); setScope("week"); }
        if (e.key === "3") { e.preventDefault(); setScope("month"); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#FAFAF7" }}
    >
      {/* Sticky header bar */}
      <div className="sticky top-0 z-20 border-b border-stone-150 bg-[#FAFAF7]/90 backdrop-blur-md">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <ScopeSelector scope={scope} onChange={setScope} />
            <div className="text-[12px] text-stone-400 font-mono">
              {formatEditorialDate(today)}
            </div>
          </div>
          {scope === "day" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2"
            >
              <ProjectRail selectedProject={selectedProject} onSelect={setSelectedProject} />
            </motion.div>
          )}
        </div>
      </div>

      {/* Content stream */}
      <div className="mx-auto max-w-2xl px-4 py-6">
        <AnimatePresence mode="wait">
          {scope === "day" && (
            <motion.div
              key="day"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {dateRange.map(dateStr => {
                const dateTasks = tasksByDate.get(dateStr) ?? [];
                const isToday = dateStr === todayStr;
                const isPast = dateStr < todayStr;
                return (
                  <DateSection
                    key={dateStr}
                    dateStr={dateStr}
                    tasks={dateTasks}
                    isToday={isToday}
                    isPast={isPast}
                    expandedTaskId={expandedTaskId}
                    onToggleTask={handleToggleTask}
                    scope="day"
                  />
                );
              })}
              <SomedaySection
                tasks={somedayTasks}
                expandedTaskId={expandedTaskId}
                onToggleTask={handleToggleTask}
              />
            </motion.div>
          )}

          {scope === "week" && (
            <motion.div
              key="week"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-8"
            >
              {weekRanges.map(week => {
                const isCurrent = week.dates.includes(todayStr);
                return (
                  <WeekSection
                    key={week.start}
                    label={week.label}
                    dates={week.dates}
                    tasksByDate={tasksByDate}
                    expandedTaskId={expandedTaskId}
                    onToggleTask={handleToggleTask}
                    isCurrent={isCurrent}
                  />
                );
              })}
              <SomedaySection
                tasks={somedayTasks}
                expandedTaskId={expandedTaskId}
                onToggleTask={handleToggleTask}
              />
            </motion.div>
          )}

          {scope === "month" && (
            <motion.div
              key="month"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <MonthOverview weekRanges={weekRanges} tasksByDate={tasksByDate} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Paper texture overlay (subtle) */}
      <div
        className="pointer-events-none fixed inset-0 z-[9999] opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
        }}
      />
    </div>
  );
}
