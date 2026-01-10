"use client";

import { useState, useMemo, useEffect } from "react";
import { api } from "import-alias/trpc/react";
import type { AppRouter } from "import-alias/server/api/root";
import type { inferRouterOutputs } from "@trpc/server";
import { CreateTaskModal } from "./create-task-modal";
import { motion } from "framer-motion";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Task = RouterOutputs["tasks"]["list"][number];
type Project = RouterOutputs["projects"]["list"][number];
type User = RouterOutputs["users"]["list"][number];

interface DashboardContentProps {
  currentUser: User;
}

// Get current week dates (Mon-Sun)
function getWeekDates() {
  const today = new Date();
  const currentDay = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));

  const week = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    week.push(date);
  }
  return week;
}

function formatDate(date: Date) {
  // Use local date to avoid timezone issues
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function DashboardContent({ currentUser }: DashboardContentProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalPrefilledDate, setModalPrefilledDate] = useState<
    string | undefined
  >();
  const [modalPrefilledProjectId, setModalPrefilledProjectId] = useState<
    string | undefined
  >();
  const [modalAnchorElement, setModalAnchorElement] = useState<
    HTMLElement | null
  >(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const isAdmin = currentUser.role === "admin";

  // Fetch data
  const { data: tasks, isLoading: tasksLoading } = api.tasks.list.useQuery({
    projectId: selectedProjectId ?? undefined,
    status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
  });

  const { data: projects, isLoading: projectsLoading } =
    api.projects.list.useQuery();

  const { data: users, isLoading: usersLoading } = api.users.list.useQuery();

  const weekDates = useMemo(() => getWeekDates(), []);

  // Filter tasks by selected user (admin only)
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    if (!isAdmin || !selectedUserId) return tasks;

    return tasks.filter((task) => task.created_by === selectedUserId);
  }, [tasks, isAdmin, selectedUserId]);

  // Group tasks by project
  const tasksByProject = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    filteredTasks.forEach((task) => {
      const projectId = task.project_id ?? "unassigned";
      if (!grouped.has(projectId)) {
        grouped.set(projectId, []);
      }
      grouped.get(projectId)!.push(task);
    });
    return grouped;
  }, [filteredTasks]);

  // Get task for specific day
  const getTasksForDay = (projectTasks: Task[], date: Date) => {
    const dateStr = formatDate(date);
    return projectTasks.filter((task) => {
      // Show task if it's due on this day or scheduled to start
      return task.due_date === dateStr || task.start_date === dateStr;
    });
  };

  const handleOpenModal = (
    e: React.MouseEvent<HTMLButtonElement>,
    date: Date,
    projectId?: string,
  ) => {
    setModalAnchorElement(e.currentTarget);
    setModalPrefilledDate(formatDate(date));
    setModalPrefilledProjectId(projectId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalPrefilledDate(undefined);
    setModalPrefilledProjectId(undefined);
    setModalAnchorElement(null);
    setEditingTask(null);
  };

  const handleTaskClick = (e: React.MouseEvent<HTMLDivElement>, task: Task) => {
    setModalAnchorElement(e.currentTarget);
    setEditingTask(task);
    setIsModalOpen(true);
  };

  if (tasksLoading || projectsLoading || usersLoading) {
    return <div>Loading...</div>;
  }

  const statusOptions = ["todo", "in_progress", "done", "blocked"];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">
            Project
          </label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
            value={selectedProjectId ?? ""}
            onChange={(e) => setSelectedProjectId(e.target.value || null)}
          >
            <option value="">All Projects</option>
            {projects?.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        {isAdmin && (
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-gray-500">
              User
            </label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
              value={selectedUserId ?? ""}
              onChange={(e) => setSelectedUserId(e.target.value || null)}
            >
              <option value="">All Users</option>
              {users?.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.display_name} ({user.role})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">
            Status
          </label>
          <div className="flex flex-wrap gap-3">
            {statusOptions.map((status) => (
              <label key={status} className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={selectedStatuses.includes(status)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedStatuses([...selectedStatuses, status]);
                    } else {
                      setSelectedStatuses(
                        selectedStatuses.filter((s) => s !== status),
                      );
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                {status.replace("_", " ")}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Week View */}
      <div className="overflow-hidden rounded-lg border bg-white">
        {/* Week Header */}
        <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-50">
          <div className="border-r border-gray-200 p-4 text-sm font-medium text-gray-600">
            Project
          </div>
          {weekDates.map((date, i) => (
            <div
              key={i}
              className={`p-4 text-center text-sm font-medium ${
                date.toDateString() === new Date().toDateString()
                  ? "bg-gray-900 text-white"
                  : "text-gray-600"
              }`}
            >
              {formatDayLabel(date)}
            </div>
          ))}
        </div>

        {/* Tasks grouped by project */}
        {Array.from(tasksByProject.entries()).map(
          ([projectId, projectTasks]) => {
            const project = projects?.find((p) => p.id === projectId);
            const projectName = project?.name ?? "Unassigned";

            return (
              <div key={projectId} className="border-b border-gray-200 last:border-b-0">
                <div className="grid grid-cols-8">
                  {/* Project Name */}
                  <div className="flex items-start border-r border-gray-200 bg-gray-50 p-4">
                    <span className="text-sm font-medium text-gray-900">{projectName}</span>
                    <span className="ml-2 text-xs text-gray-400">
                      {projectTasks.length}
                    </span>
                  </div>

                  {/* Days */}
                  {weekDates.map((date, dayIndex) => {
                    const dayTasks = getTasksForDay(projectTasks, date);

                    return (
                      <div
                        key={dayIndex}
                        className={`group relative min-h-[100px] border-l border-gray-100 p-2 ${
                          date.toDateString() === new Date().toDateString()
                            ? "bg-gray-50"
                            : ""
                        }`}
                      >
                        <div className="space-y-1">
                          {dayTasks.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              onClick={(e) => handleTaskClick(e, task)}
                            />
                          ))}
                        </div>

                        {/* Add Task Button */}
                        <button
                          onClick={(e) =>
                            handleOpenModal(
                              e,
                              date,
                              projectId !== "unassigned" ? projectId : undefined,
                            )
                          }
                          className="absolute bottom-1 right-1 rounded-md bg-gray-900 p-1 text-white opacity-0 transition-opacity hover:bg-gray-800 group-hover:opacity-100"
                          title="Add task"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          },
        )}

        {tasksByProject.size === 0 && (
          <div className="p-8 text-center text-gray-500">
            No tasks found. Try adjusting your filters.
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Tasks" value={filteredTasks?.length ?? 0} />
        <StatCard
          label="Todo"
          value={filteredTasks?.filter((t) => t.status === "todo").length ?? 0}
        />
        <StatCard
          label="In Progress"
          value={filteredTasks?.filter((t) => t.status === "in_progress").length ?? 0}
        />
        <StatCard
          label="Done"
          value={filteredTasks?.filter((t) => t.status === "done").length ?? 0}
        />
      </div>

      {/* Create/Edit Task Modal */}
      <CreateTaskModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        projects={projects ?? []}
        prefilledDate={modalPrefilledDate}
        prefilledProjectId={modalPrefilledProjectId}
        anchorElement={modalAnchorElement}
        task={editingTask ?? undefined}
      />
    </div>
  );
}

// Hook to detect prefers-reduced-motion
function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return prefersReducedMotion;
}

// Animation constants
const taskCardVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
};

const taskCardTransition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 25,
  duration: 0.35,
};

const taskCardHover = {
  scale: 1.01,
  y: -4,
  transition: { type: "spring" as const, stiffness: 400, damping: 20 },
};

function TaskCard({
  task,
  onClick,
}: {
  task: Task;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const statusStyles: Record<string, { bg: string; indicator: string }> = {
    todo: { bg: "bg-gray-50 border-gray-200", indicator: "bg-gray-400" },
    in_progress: { bg: "bg-gray-50 border-gray-300", indicator: "bg-gray-900" },
    done: { bg: "bg-gray-50 border-gray-200", indicator: "bg-gray-300" },
    blocked: { bg: "bg-red-50 border-red-200", indicator: "bg-red-400" },
  };

  const style = statusStyles[task.status] ?? statusStyles.todo;

  const cardContent = (
    <div className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${style.indicator}`} />
      <span className="truncate font-medium text-gray-900" title={task.title}>
        {task.title}
      </span>
    </div>
  );

  // Render static div if user prefers reduced motion
  if (prefersReducedMotion) {
    return (
      <div
        className={`cursor-pointer rounded-md border p-2 text-xs ${style.bg}`}
        onClick={onClick}
      >
        {cardContent}
      </div>
    );
  }

  return (
    <motion.div
      className={`cursor-pointer rounded-md border p-2 text-xs ${style.bg}`}
      onClick={onClick}
      variants={taskCardVariants}
      initial="initial"
      animate="animate"
      transition={taskCardTransition}
      whileHover={taskCardHover}
    >
      {cardContent}
    </motion.div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">{value}</div>
    </div>
  );
}
