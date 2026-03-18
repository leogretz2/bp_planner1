// PROTOTYPE: Using mock data. Will connect to tRPC in production.
"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MOCK_TASKS,
  MOCK_PROJECTS,
  PROJECT_COLORS,
  type MockTask,
} from "./mock-data";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DashboardContentProps {
  currentUser: { id: string; display_name: string; role: string; [key: string]: unknown };
}

type TimeHorizon = "today" | "this_week" | "this_month" | "later";

interface PlacedTask extends MockTask {
  horizon: TimeHorizon;
  angle: number; // radians
  radius: number; // 0-1 normalized
}

// ── Constants ──────────────────────────────────────────────────────────────────

const RING_RADII = {
  today: 0.2,
  this_week: 0.42,
  this_month: 0.64,
  later: 0.84,
} as const;

const RING_LABELS: Record<TimeHorizon, string> = {
  today: "TODAY",
  this_week: "THIS WEEK",
  this_month: "THIS MONTH",
  later: "LATER",
};

const STATUS_OPACITY: Record<string, number> = {
  in_progress: 1,
  todo: 0.75,
  blocked: 0.85,
  done: 0.3,
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const ZOOM_SPEED = 0.002;

// ── Helpers ────────────────────────────────────────────────────────────────────

function classifyHorizon(dueDate: string | null): TimeHorizon {
  if (!dueDate) return "later";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const diffDays = Math.floor(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays <= 0) return "today";
  if (diffDays <= 7) return "this_week";
  if (diffDays <= 30) return "this_month";
  return "later";
}

function placeTasks(tasks: MockTask[]): PlacedTask[] {
  const grouped: Record<TimeHorizon, MockTask[]> = {
    today: [],
    this_week: [],
    this_month: [],
    later: [],
  };

  tasks.forEach((t) => {
    const h = classifyHorizon(t.due_date);
    grouped[h].push(t);
  });

  const placed: PlacedTask[] = [];

  (Object.keys(grouped) as TimeHorizon[]).forEach((horizon) => {
    const ring = grouped[horizon];
    const baseRadius = RING_RADII[horizon];
    ring.forEach((task, i) => {
      const angleStep = (2 * Math.PI) / Math.max(ring.length, 1);
      // Offset so tasks don't all start at 12 o'clock
      const angle = angleStep * i - Math.PI / 2 + (Math.PI / 12) * (horizon === "today" ? 0 : 1);
      // Add slight radial jitter for visual interest
      const jitter = (Math.sin(i * 7.3 + task.id.charCodeAt(1)) * 0.03);
      placed.push({
        ...task,
        horizon,
        angle,
        radius: baseRadius + jitter,
      });
    });
  });

  return placed;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function DashboardContent({ currentUser: _currentUser }: DashboardContentProps) {
  const [zoom, setZoom] = useState(1);
  const [hoveredTask, setHoveredTask] = useState<PlacedTask | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Filter out done tasks from main view? No — show them dimmed.
  const activeTasks = useMemo(() => {
    if (selectedProject) {
      return MOCK_TASKS.filter((t) => t.project_id === selectedProject);
    }
    return MOCK_TASKS;
  }, [selectedProject]);

  const placedTasks = useMemo(() => placeTasks(activeTasks), [activeTasks]);

  const unscheduledTasks = useMemo(
    () => activeTasks.filter((t) => t.due_date === null),
    [activeTasks]
  );

  // Zoom via scroll
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => {
      const next = prev + e.deltaY * ZOOM_SPEED;
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    });
  }, []);

  // SVG viewbox dimensions
  const viewSize = 800;
  const center = viewSize / 2;

  // Convert polar to SVG cartesian
  const toXY = (angle: number, radius: number) => ({
    x: center + Math.cos(angle) * radius * center * 0.95,
    y: center + Math.sin(angle) * radius * center * 0.95,
  });

  // Handle hover
  const handleMouseEnter = (task: PlacedTask, e: React.MouseEvent) => {
    setHoveredTask(task);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (hoveredTask) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setTooltipPos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    }
  };

  const handleMouseLeave = () => {
    setHoveredTask(null);
  };

  const handleTaskClick = (task: PlacedTask) => {
    console.log("[Orbital] Task clicked:", task.title, task);
  };

  // Node size based on estimated hours
  const getNodeSize = (task: MockTask) => {
    const base = 6;
    const hours = task.estimated_hours ?? 2;
    return base + Math.min(hours, 15) * 0.6;
  };

  // Ring descriptions for SVG
  const rings: { horizon: TimeHorizon; radius: number }[] = [
    { horizon: "today", radius: RING_RADII.today },
    { horizon: "this_week", radius: RING_RADII.this_week },
    { horizon: "this_month", radius: RING_RADII.this_month },
    { horizon: "later", radius: RING_RADII.later },
  ];

  // Prevent page scroll when wheeling over the orbital
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", prevent, { passive: false });
    return () => el.removeEventListener("wheel", prevent);
  }, []);

  return (
    <div className="orbital-container font-mono" style={{ background: "#0a0a0f" }}>
      {/* Project legend + filter */}
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedProject(null)}
            className={`rounded-full border px-3 py-1 text-xs tracking-wider transition-colors ${
              selectedProject === null
                ? "border-white/30 bg-white/10 text-white"
                : "border-white/10 text-white/40 hover:text-white/70"
            }`}
          >
            ALL
          </button>
          {MOCK_PROJECTS.map((p) => {
            const colors = PROJECT_COLORS[p.id];
            const isActive = selectedProject === p.id;
            return (
              <button
                key={p.id}
                onClick={() =>
                  setSelectedProject(isActive ? null : p.id)
                }
                className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs tracking-wider transition-colors"
                style={{
                  borderColor: isActive ? colors?.accent : "rgba(255,255,255,0.1)",
                  background: isActive ? colors?.muted : "transparent",
                  color: isActive ? colors?.accent : "rgba(255,255,255,0.4)",
                }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: colors?.accent }}
                />
                {p.name}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-xs text-white/30">
          <span>ZOOM {(zoom * 100).toFixed(0)}%</span>
          <span className="text-white/15">|</span>
          <span>{activeTasks.length} tasks</span>
        </div>
      </div>

      {/* Orbital SVG */}
      <div
        ref={containerRef}
        className="relative mx-auto flex items-center justify-center overflow-hidden"
        style={{ height: "calc(100vh - 180px)", maxHeight: "900px" }}
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${viewSize} ${viewSize}`}
          className="h-full w-full transition-transform duration-300 ease-out"
          style={{
            transform: `scale(${zoom})`,
            maxWidth: "900px",
            maxHeight: "900px",
          }}
        >
          {/* Background grid — subtle radial lines */}
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
            const outer = toXY(angle, 0.98);
            return (
              <line
                key={`grid-${i}`}
                x1={center}
                y1={center}
                x2={outer.x}
                y2={outer.y}
                stroke="rgba(255,255,255,0.03)"
                strokeWidth={0.5}
              />
            );
          })}

          {/* Orbital rings */}
          {rings.map(({ horizon, radius }) => (
            <g key={horizon}>
              {/* Ring circle */}
              <circle
                cx={center}
                cy={center}
                r={radius * center * 0.95}
                fill="none"
                stroke={
                  horizon === "today"
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(255,255,255,0.06)"
                }
                strokeWidth={horizon === "today" ? 1.5 : 0.8}
                strokeDasharray={
                  horizon === "later" ? "4 4" : undefined
                }
              />
              {/* Ring label */}
              <text
                x={center + radius * center * 0.95 + 8}
                y={center - 4}
                fill={
                  horizon === "today"
                    ? "rgba(255,255,255,0.35)"
                    : "rgba(255,255,255,0.15)"
                }
                fontSize={horizon === "today" ? 10 : 8}
                fontFamily="monospace"
                letterSpacing="0.1em"
              >
                {RING_LABELS[horizon]}
              </text>
            </g>
          ))}

          {/* Center point — "NOW" */}
          <circle
            cx={center}
            cy={center}
            r={4}
            fill="rgba(255,255,255,0.6)"
          >
            <animate
              attributeName="r"
              values="3;5;3"
              dur="3s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.6;1;0.6"
              dur="3s"
              repeatCount="indefinite"
            />
          </circle>
          <text
            x={center}
            y={center + 16}
            textAnchor="middle"
            fill="rgba(255,255,255,0.3)"
            fontSize={7}
            fontFamily="monospace"
            letterSpacing="0.15em"
          >
            NOW
          </text>

          {/* Task nodes */}
          {placedTasks.map((task) => {
            if (task.due_date === null) return null; // unscheduled handled separately
            const pos = toXY(task.angle, task.radius);
            const colors = PROJECT_COLORS[task.project_id];
            const size = getNodeSize(task);
            const opacity = STATUS_OPACITY[task.status] ?? 0.5;
            const isBlocked = task.status === "blocked";
            const isInProgress = task.status === "in_progress";
            const isDone = task.status === "done";
            const isHovered = hoveredTask?.id === task.id;

            return (
              <g
                key={task.id}
                className="cursor-pointer"
                onMouseEnter={(e) => handleMouseEnter(task, e)}
                onMouseLeave={handleMouseLeave}
                onClick={() => handleTaskClick(task)}
                style={{ opacity }}
              >
                {/* Glow effect for active tasks */}
                {isInProgress && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={size + 6}
                    fill={colors?.glow ?? "rgba(255,255,255,0.2)"}
                  >
                    <animate
                      attributeName="r"
                      values={`${size + 4};${size + 10};${size + 4}`}
                      dur="2.5s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.6;0.2;0.6"
                      dur="2.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Blocked indicator — pulsing red ring */}
                {isBlocked && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={size + 4}
                    fill="none"
                    stroke="rgba(239, 68, 68, 0.6)"
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                  >
                    <animate
                      attributeName="opacity"
                      values="0.8;0.3;0.8"
                      dur="1.8s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Main node */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isHovered ? size + 2 : size}
                  fill={isDone ? "rgba(255,255,255,0.15)" : (colors?.accent ?? "#fff")}
                  stroke={isHovered ? "#fff" : "none"}
                  strokeWidth={isHovered ? 1 : 0}
                  style={{
                    transition: "r 0.2s ease, stroke-width 0.2s ease",
                    filter: isDone ? "none" : `drop-shadow(0 0 ${isInProgress ? 6 : 3}px ${colors?.glow ?? "rgba(255,255,255,0.3)"})`,
                  }}
                />

                {/* Priority indicator — small inner dot for high priority */}
                {task.priority <= 2 && !isDone && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={2}
                    fill="#fff"
                    opacity={0.9}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        <AnimatePresence>
          {hoveredTask && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none absolute z-50 max-w-xs rounded-lg border border-white/10 bg-black/90 px-4 py-3 font-mono text-xs shadow-2xl backdrop-blur-sm"
              style={{
                left: tooltipPos.x + 16,
                top: tooltipPos.y - 8,
              }}
            >
              <div className="mb-1 flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    background:
                      PROJECT_COLORS[hoveredTask.project_id]?.accent ?? "#fff",
                  }}
                />
                <span className="text-white/50">
                  {MOCK_PROJECTS.find((p) => p.id === hoveredTask.project_id)
                    ?.name ?? "—"}
                </span>
              </div>
              <div className="mb-2 text-sm font-medium text-white">
                {hoveredTask.title}
              </div>
              <div className="flex items-center gap-3 text-white/40">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                    hoveredTask.status === "in_progress"
                      ? "bg-white/10 text-white/70"
                      : hoveredTask.status === "blocked"
                        ? "bg-red-500/20 text-red-400"
                        : hoveredTask.status === "done"
                          ? "bg-white/5 text-white/30"
                          : "bg-white/5 text-white/50"
                  }`}
                >
                  {hoveredTask.status.replace("_", " ")}
                </span>
                {hoveredTask.due_date && (
                  <span>due {hoveredTask.due_date}</span>
                )}
                {hoveredTask.estimated_hours && (
                  <span>{hoveredTask.estimated_hours}h est</span>
                )}
              </div>
              {hoveredTask.description && (
                <div className="mt-2 border-t border-white/10 pt-2 text-white/30">
                  {hoveredTask.description}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Unscheduled tasks — floating sidebar strip */}
      {unscheduledTasks.length > 0 && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-4 backdrop-blur-sm">
            <div className="mb-3 text-center text-[10px] uppercase tracking-[0.2em] text-white/20">
              Unscheduled
            </div>
            <div className="flex flex-col gap-2">
              {unscheduledTasks.map((task) => {
                const colors = PROJECT_COLORS[task.project_id];
                return (
                  <div
                    key={task.id}
                    className="group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-white/5"
                    onClick={() =>
                      console.log("[Orbital] Unscheduled task clicked:", task.title)
                    }
                    title={task.title}
                  >
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: colors?.accent }}
                    />
                    <span className="max-w-[120px] truncate text-[11px] text-white/40 group-hover:text-white/70">
                      {task.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Status legend — bottom */}
      <div className="flex items-center justify-center gap-6 py-3 text-[10px] uppercase tracking-[0.15em] text-white/20">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-white" />
          In Progress
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/50" />
          Todo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/20" />
          Done
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              border: "1px dashed rgba(239, 68, 68, 0.6)",
              background: "transparent",
            }}
          />
          Blocked
        </span>
        <span className="text-white/10">|</span>
        <span className="text-white/15">scroll to zoom</span>
      </div>
    </div>
  );
}
