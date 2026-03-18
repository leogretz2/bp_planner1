"use client";

// PROTOTYPE: Using mock data. Will connect to tRPC in production.

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  MOCK_TASKS,
  MOCK_PROJECTS,
  PROJECT_COLORS,
  type MockTask,
  type MockProject,
} from "./mock-data";

type Scope = "day" | "week" | "month";
type Pane = "projects" | "tasks" | "detail";

interface DashboardContentProps {
  currentUser: { id: string; display_name: string | null; email: string; role: string };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_ICON: Record<string, string> = {
  todo: "[ ]",
  in_progress: "[~]",
  done: "[x]",
  blocked: "[!]",
};

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekEnd(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonthEnd(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function filterByScope(tasks: MockTask[], scope: Scope): MockTask[] {
  const today = getToday();

  if (scope === "day") {
    return tasks.filter((t) => t.due_date === today);
  }

  if (scope === "week") {
    const start = getWeekStart();
    const end = getWeekEnd();
    return tasks.filter((t) => {
      if (!t.due_date) return false;
      return t.due_date >= start && t.due_date <= end;
    });
  }

  // month: tasks with dates this month + undated
  const start = getMonthStart();
  const end = getMonthEnd();
  return tasks.filter((t) => {
    if (!t.due_date) return true;
    return t.due_date >= start && t.due_date <= end;
  });
}

function projectName(id: string): string {
  return MOCK_PROJECTS.find((p) => p.id === id)?.name ?? "Unknown";
}

function taskCountForProject(tasks: MockTask[], projectId: string | null): number {
  if (!projectId) return tasks.length;
  return tasks.filter((t) => t.project_id === projectId).length;
}

// ── Component ────────────────────────────────────────────────────────────────

export function DashboardContent({ currentUser }: DashboardContentProps) {
  const [scope, setScope] = useState<Scope>("week");
  const [focusedPane, setFocusedPane] = useState<Pane>("tasks");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(0);
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [detailExpanded, setDetailExpanded] = useState(true);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const taskListRef = useRef<HTMLDivElement>(null);

  // Derive filtered tasks
  const scopedTasks = useMemo(() => filterByScope(MOCK_TASKS, scope), [scope]);

  const filteredTasks = useMemo(() => {
    let tasks = scopedTasks;
    if (selectedProjectId) {
      tasks = tasks.filter((t) => t.project_id === selectedProjectId);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      tasks = tasks.filter((t) => t.title.toLowerCase().includes(q));
    }
    // Sort: priority asc, then status order
    const statusOrder: Record<string, number> = { in_progress: 0, todo: 1, blocked: 2, done: 3 };
    return [...tasks].sort((a, b) => {
      const sa = statusOrder[a.status] ?? 9;
      const sb = statusOrder[b.status] ?? 9;
      if (sa !== sb) return sa - sb;
      return a.priority - b.priority;
    });
  }, [scopedTasks, selectedProjectId, searchQuery]);

  const selectedTask: MockTask | null = filteredTasks[selectedTaskIndex] ?? null;

  // Project list for left pane
  const projectList = useMemo(() => {
    return [{ id: null, name: "All" }, ...MOCK_PROJECTS.map((p) => ({ id: p.id as string | null, name: p.name }))];
  }, []);

  // Clamp indices
  useEffect(() => {
    if (selectedTaskIndex >= filteredTasks.length) {
      setSelectedTaskIndex(Math.max(0, filteredTasks.length - 1));
    }
  }, [filteredTasks.length, selectedTaskIndex]);

  useEffect(() => {
    if (selectedProjectIndex >= projectList.length) {
      setSelectedProjectIndex(Math.max(0, projectList.length - 1));
    }
  }, [projectList.length, selectedProjectIndex]);

  // Scroll selected task into view
  useEffect(() => {
    if (taskListRef.current) {
      const items = taskListRef.current.querySelectorAll("[data-task-row]");
      const item = items[selectedTaskIndex];
      if (item) {
        item.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedTaskIndex]);

  // ── Keyboard handler ──────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // If searching, only handle escape and enter
      if (isSearching) {
        if (e.key === "Escape") {
          setIsSearching(false);
          setSearchQuery("");
          searchInputRef.current?.blur();
          e.preventDefault();
        }
        return;
      }

      // Help overlay
      if (e.key === "?") {
        e.preventDefault();
        setShowHelp((h) => !h);
        return;
      }

      if (showHelp) {
        if (e.key === "Escape" || e.key === "?") {
          setShowHelp(false);
          e.preventDefault();
        }
        return;
      }

      // Scope switching
      if (e.key === "1") { setScope("day"); e.preventDefault(); return; }
      if (e.key === "2") { setScope("week"); e.preventDefault(); return; }
      if (e.key === "3") { setScope("month"); e.preventDefault(); return; }

      // Search
      if (e.key === "/") {
        e.preventDefault();
        setIsSearching(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
        return;
      }

      // Tab: cycle panes
      if (e.key === "Tab") {
        e.preventDefault();
        const panes: Pane[] = ["projects", "tasks", "detail"];
        const idx = panes.indexOf(focusedPane);
        setFocusedPane(panes[(idx + 1) % panes.length]!);
        return;
      }

      // Enter: toggle detail pane
      if (e.key === "Enter") {
        e.preventDefault();
        setDetailExpanded((d) => !d);
        return;
      }

      // Navigation
      if (focusedPane === "tasks") {
        if (e.key === "j" || e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedTaskIndex((i) => Math.min(i + 1, filteredTasks.length - 1));
        } else if (e.key === "k" || e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedTaskIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === "h" || e.key === "ArrowLeft") {
          e.preventDefault();
          setFocusedPane("projects");
        } else if (e.key === "l" || e.key === "ArrowRight") {
          e.preventDefault();
          setFocusedPane("detail");
        } else if (e.key === "d") {
          e.preventDefault();
          // Toggle done on selected task (mock — just log)
          if (selectedTask) {
            const task = MOCK_TASKS.find((t) => t.id === selectedTask.id);
            if (task) {
              task.status = task.status === "done" ? "todo" : "done";
              // Force re-render by changing scope back and forth
              setScope((s) => s);
            }
          }
        }
      } else if (focusedPane === "projects") {
        if (e.key === "j" || e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedProjectIndex((i) => Math.min(i + 1, projectList.length - 1));
          const proj = projectList[Math.min(selectedProjectIndex + 1, projectList.length - 1)];
          if (proj) {
            setSelectedProjectId(proj.id);
            setSelectedTaskIndex(0);
          }
        } else if (e.key === "k" || e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedProjectIndex((i) => Math.max(i - 1, 0));
          const proj = projectList[Math.max(selectedProjectIndex - 1, 0)];
          if (proj) {
            setSelectedProjectId(proj.id);
            setSelectedTaskIndex(0);
          }
        } else if (e.key === "l" || e.key === "ArrowRight") {
          e.preventDefault();
          setFocusedPane("tasks");
        } else if (e.key === "Enter") {
          e.preventDefault();
          const proj = projectList[selectedProjectIndex];
          if (proj) {
            setSelectedProjectId(proj.id);
            setSelectedTaskIndex(0);
            setFocusedPane("tasks");
          }
        }
      } else if (focusedPane === "detail") {
        if (e.key === "h" || e.key === "ArrowLeft") {
          e.preventDefault();
          setFocusedPane("tasks");
        }
      }

      // Escape
      if (e.key === "Escape") {
        e.preventDefault();
        setShowHelp(false);
        setIsSearching(false);
        setSearchQuery("");
      }
    },
    [
      isSearching,
      showHelp,
      focusedPane,
      filteredTasks.length,
      selectedTask,
      selectedProjectIndex,
      projectList,
    ],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // ── Render ────────────────────────────────────────────────────────────────

  const paneBorder = (pane: Pane) =>
    focusedPane === pane ? "border-[#555]" : "border-[#333]";

  return (
    <div
      className="font-mono flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: "#0D0D0D", color: "#CCC", fontSize: "13px", lineHeight: "1.4" }}
    >
      {/* Help overlay */}
      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left pane: Project tree */}
        <div
          className={`flex w-56 shrink-0 flex-col border-r ${paneBorder("projects")}`}
          style={{ borderColor: focusedPane === "projects" ? "#555" : "#333" }}
        >
          <div
            className="border-b px-3 py-1.5"
            style={{
              borderColor: "#333",
              color: "#666",
              fontSize: "11px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Projects
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {projectList.map((proj, i) => {
              const isSelected = i === selectedProjectIndex && focusedPane === "projects";
              const isActive = selectedProjectId === proj.id;
              const count = taskCountForProject(scopedTasks, proj.id);
              const color = proj.id ? PROJECT_COLORS[proj.id]?.tag : undefined;

              return (
                <div
                  key={proj.id ?? "all"}
                  className="flex cursor-pointer items-center px-3 py-0.5"
                  style={{
                    background: isSelected ? "#FFF" : "transparent",
                    color: isSelected ? "#000" : isActive ? "#FFF" : "#999",
                  }}
                  onClick={() => {
                    setSelectedProjectId(proj.id);
                    setSelectedProjectIndex(i);
                    setSelectedTaskIndex(0);
                  }}
                >
                  <span className="mr-2" style={{ color: isSelected ? "#000" : "#555" }}>
                    {isActive ? ">" : " "}
                  </span>
                  {color && (
                    <span
                      className="mr-1.5 inline-block h-2 w-2"
                      style={{ background: color }}
                    />
                  )}
                  <span className="flex-1 truncate">{proj.name}</span>
                  <span style={{ color: isSelected ? "#555" : "#444", fontSize: "11px" }}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right area: task list + detail */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Task list pane */}
          <div
            className={`flex flex-1 flex-col border-b ${paneBorder("tasks")}`}
            style={{ borderColor: focusedPane === "tasks" ? "#555" : "#333" }}
          >
            {/* Task list header with search */}
            <div
              className="flex items-center border-b px-3 py-1.5"
              style={{ borderColor: "#333" }}
            >
              <span
                style={{
                  color: "#666",
                  fontSize: "11px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Tasks
              </span>
              <span className="mx-2" style={{ color: "#333" }}>
                |
              </span>
              <span style={{ color: "#555", fontSize: "11px" }}>
                {filteredTasks.length} items
              </span>
              <div className="flex-1" />
              {isSearching ? (
                <div className="flex items-center">
                  <span style={{ color: "#666" }}>/</span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setIsSearching(false);
                        setSearchQuery("");
                        e.stopPropagation();
                      } else if (e.key === "Enter") {
                        setIsSearching(false);
                        searchInputRef.current?.blur();
                        e.stopPropagation();
                      }
                    }}
                    className="ml-1 border-none bg-transparent font-mono text-[13px] text-[#FFF] outline-none"
                    style={{ width: "200px" }}
                    autoFocus
                  />
                </div>
              ) : (
                searchQuery && (
                  <span style={{ color: "#555", fontSize: "11px" }}>
                    filter: {searchQuery}
                  </span>
                )
              )}
            </div>

            {/* Task rows */}
            <div ref={taskListRef} className="flex-1 overflow-y-auto">
              {filteredTasks.length === 0 && (
                <div className="px-3 py-4" style={{ color: "#555" }}>
                  No tasks in this scope.
                </div>
              )}
              {filteredTasks.map((task, i) => {
                const isSelected = i === selectedTaskIndex;
                const isFocused = focusedPane === "tasks";
                const projColor = PROJECT_COLORS[task.project_id]?.tag ?? "#666";

                return (
                  <div
                    key={task.id}
                    data-task-row
                    className="flex cursor-pointer items-center px-3 py-0.5"
                    style={{
                      background: isSelected && isFocused ? "#FFF" : isSelected ? "#222" : "transparent",
                      color: isSelected && isFocused ? "#000" : isSelected ? "#FFF" : "#CCC",
                    }}
                    onClick={() => {
                      setSelectedTaskIndex(i);
                      setFocusedPane("tasks");
                    }}
                  >
                    {/* Cursor */}
                    <span
                      className="mr-2 w-3 shrink-0"
                      style={{
                        color: isSelected && isFocused ? "#000" : "#333",
                      }}
                    >
                      {isSelected ? ">" : " "}
                    </span>

                    {/* Status icon */}
                    <span
                      className="mr-2 shrink-0"
                      style={{
                        color:
                          isSelected && isFocused
                            ? "#000"
                            : task.status === "blocked"
                              ? "#E84747"
                              : task.status === "done"
                                ? "#555"
                                : task.status === "in_progress"
                                  ? "#47E8B5"
                                  : "#666",
                      }}
                    >
                      {STATUS_ICON[task.status]}
                    </span>

                    {/* Title */}
                    <span
                      className="flex-1 truncate"
                      style={{
                        color:
                          isSelected && isFocused
                            ? "#000"
                            : task.status === "done"
                              ? "#555"
                              : "#CCC",
                        textDecoration: task.status === "done" ? "line-through" : "none",
                      }}
                    >
                      {task.title}
                    </span>

                    {/* Priority */}
                    <span
                      className="mx-2 shrink-0"
                      style={{
                        color: isSelected && isFocused ? "#333" : "#444",
                        fontSize: "11px",
                      }}
                    >
                      p{task.priority}
                    </span>

                    {/* Project tag */}
                    <span
                      className="shrink-0 px-1"
                      style={{
                        color: isSelected && isFocused ? "#000" : projColor,
                        fontSize: "11px",
                      }}
                    >
                      {projectName(task.project_id).slice(0, 12)}
                    </span>

                    {/* Due date */}
                    <span
                      className="ml-2 w-24 shrink-0 text-right"
                      style={{
                        color: isSelected && isFocused ? "#333" : "#444",
                        fontSize: "11px",
                      }}
                    >
                      {task.due_date ?? "no date"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detail pane */}
          {detailExpanded && (
            <div
              className={`shrink-0 border-t ${paneBorder("detail")}`}
              style={{
                borderColor: focusedPane === "detail" ? "#555" : "#333",
                height: "220px",
                overflow: "auto",
              }}
            >
              <div
                className="border-b px-3 py-1.5"
                style={{
                  borderColor: "#333",
                  color: "#666",
                  fontSize: "11px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Detail
              </div>
              {selectedTask ? (
                <TaskDetail task={selectedTask} />
              ) : (
                <div className="px-3 py-2" style={{ color: "#444" }}>
                  No task selected.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div
        className="flex items-center justify-between border-t px-3 py-1"
        style={{
          background: "#1A1A1A",
          borderColor: "#333",
          fontSize: "11px",
        }}
      >
        <div className="flex items-center gap-4">
          <span style={{ color: "#47E8B5" }}>
            {scope.toUpperCase()}
          </span>
          <span style={{ color: "#666" }}>|</span>
          <span style={{ color: "#999" }}>
            {filteredTasks.length} tasks
          </span>
          <span style={{ color: "#666" }}>|</span>
          <span style={{ color: "#999" }}>
            {selectedProjectId
              ? projectName(selectedProjectId)
              : "All Projects"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span style={{ color: "#555" }}>
            [{focusedPane}]
          </span>
          <span style={{ color: "#444" }}>
            1/2/3:scope j/k:nav /:search ?:help Tab:pane Enter:detail d:done
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function TaskDetail({ task }: { task: MockTask }) {
  const projColor = PROJECT_COLORS[task.project_id]?.tag ?? "#666";

  return (
    <div className="px-3 py-2 font-mono" style={{ fontSize: "13px", lineHeight: "1.6" }}>
      <div className="flex">
        <span style={{ color: "#666", width: "80px", display: "inline-block" }}>title:</span>
        <span style={{ color: "#FFF" }}>{task.title}</span>
      </div>
      <div className="flex">
        <span style={{ color: "#666", width: "80px", display: "inline-block" }}>project:</span>
        <span style={{ color: projColor }}>{projectName(task.project_id)}</span>
      </div>
      <div className="flex">
        <span style={{ color: "#666", width: "80px", display: "inline-block" }}>status:</span>
        <span
          style={{
            color:
              task.status === "blocked"
                ? "#E84747"
                : task.status === "done"
                  ? "#555"
                  : task.status === "in_progress"
                    ? "#47E8B5"
                    : "#CCC",
          }}
        >
          {task.status}
        </span>
      </div>
      <div className="flex">
        <span style={{ color: "#666", width: "80px", display: "inline-block" }}>priority:</span>
        <span style={{ color: "#CCC" }}>p{task.priority}</span>
      </div>
      <div className="flex">
        <span style={{ color: "#666", width: "80px", display: "inline-block" }}>due:</span>
        <span style={{ color: "#CCC" }}>{task.due_date ?? "—"}</span>
      </div>
      <div className="flex">
        <span style={{ color: "#666", width: "80px", display: "inline-block" }}>start:</span>
        <span style={{ color: "#CCC" }}>{task.start_date ?? "—"}</span>
      </div>
      <div className="flex">
        <span style={{ color: "#666", width: "80px", display: "inline-block" }}>est:</span>
        <span style={{ color: "#CCC" }}>{task.estimated_hours ? `${task.estimated_hours}h` : "—"}</span>
      </div>
      {task.description && (
        <>
          <div style={{ color: "#333", margin: "4px 0" }}>---</div>
          <div style={{ color: "#999" }}>{task.description}</div>
        </>
      )}
    </div>
  );
}

function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.85)" }}
      onClick={onClose}
    >
      <div
        className="border font-mono"
        style={{
          background: "#0D0D0D",
          borderColor: "#555",
          padding: "24px 32px",
          maxWidth: "480px",
          width: "100%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ color: "#FFF", fontSize: "14px", marginBottom: "16px" }}>
          KEYBINDINGS
        </div>
        <div style={{ fontSize: "13px", lineHeight: "1.8" }}>
          {[
            ["j / k / ↑ / ↓", "Navigate up/down"],
            ["h / l / ← / →", "Switch pane"],
            ["Tab", "Cycle panes"],
            ["Enter", "Toggle detail pane"],
            ["d", "Toggle done status"],
            ["1 / 2 / 3", "Scope: day / week / month"],
            ["/", "Search tasks"],
            ["?", "Toggle this help"],
            ["Esc", "Close / clear"],
          ].map(([key, desc]) => (
            <div key={key} className="flex">
              <span style={{ color: "#E8C547", width: "160px", display: "inline-block" }}>
                {key}
              </span>
              <span style={{ color: "#999" }}>{desc}</span>
            </div>
          ))}
        </div>
        <div style={{ color: "#444", marginTop: "16px", fontSize: "11px" }}>
          Press ? or Esc to close
        </div>
      </div>
    </div>
  );
}
