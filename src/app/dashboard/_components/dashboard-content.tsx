"use client";

import { useState, useMemo } from "react";
import { api } from "import-alias/trpc/react";
import type { AppRouter } from "import-alias/server/api/root";
import type { inferRouterOutputs } from "@trpc/server";
import { CreateTaskModal } from "./create-task-modal";

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
  return date.toISOString().split("T")[0]; // YYYY-MM-DD
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
      <div className="flex items-center gap-4 rounded-lg border bg-white p-4">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium">
            Filter by Project
          </label>
          <select
            className="w-full rounded border p-2"
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
            <label className="mb-2 block text-sm font-medium">
              Filter by User
            </label>
            <select
              className="w-full rounded border p-2"
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
          <label className="mb-2 block text-sm font-medium">
            Filter by Status
          </label>
          <div className="flex gap-2">
            {statusOptions.map((status) => (
              <label key={status} className="flex items-center gap-1 text-sm">
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
        <div className="grid grid-cols-8 border-b bg-gray-50">
          <div className="border-r p-4 font-semibold">Project</div>
          {weekDates.map((date, i) => (
            <div
              key={i}
              className={`p-4 text-center font-medium ${
                date.toDateString() === new Date().toDateString()
                  ? "bg-blue-50 text-blue-700"
                  : ""
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
              <div key={projectId} className="border-b last:border-b-0">
                <div className="grid grid-cols-8">
                  {/* Project Name */}
                  <div className="flex items-start border-r bg-gray-50 p-4 font-medium">
                    {projectName}
                    <span className="ml-2 text-xs text-gray-500">
                      ({projectTasks.length})
                    </span>
                  </div>

                  {/* Days */}
                  {weekDates.map((date, dayIndex) => {
                    const dayTasks = getTasksForDay(projectTasks, date);

                    return (
                      <div
                        key={dayIndex}
                        className={`group relative min-h-[100px] border-l p-2 ${
                          date.toDateString() === new Date().toDateString()
                            ? "bg-blue-50/30"
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
                          className="absolute bottom-1 right-1 rounded bg-blue-500 p-1 text-white opacity-0 transition-opacity hover:bg-blue-600 group-hover:opacity-100"
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

function TaskCard({
  task,
  onClick,
}: {
  task: Task;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const statusColors: Record<string, string> = {
    todo: "bg-gray-200 text-gray-800",
    in_progress: "bg-blue-200 text-blue-800",
    done: "bg-green-200 text-green-800",
    blocked: "bg-red-200 text-red-800",
  };

  const statusColor = statusColors[task.status] ?? "bg-gray-100";

  return (
    <div
      className={`cursor-pointer rounded p-2 text-xs transition hover:opacity-80 ${statusColor}`}
      onClick={onClick}
    >
      <div className="truncate font-medium" title={task.title}>
        {task.title}
      </div>
      <div className="mt-1 text-[10px] opacity-80">
        {task.status.replace("_", " ")}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
