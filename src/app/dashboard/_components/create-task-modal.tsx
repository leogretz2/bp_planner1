"use client";

import { useState, useEffect } from "react";
import { api } from "import-alias/trpc/react";
import { Modal } from "./modal";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "import-alias/server/api/root";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Project = RouterOutputs["projects"]["list"][number];
type Task = RouterOutputs["tasks"]["list"][number];

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  prefilledDate?: string; // YYYY-MM-DD
  prefilledProjectId?: string;
  anchorElement?: HTMLElement | null;
  task?: Task; // If provided, we're in edit mode
}

export function CreateTaskModal({
  isOpen,
  onClose,
  projects,
  prefilledDate,
  prefilledProjectId,
  anchorElement,
  task,
}: CreateTaskModalProps) {
  const isEditMode = !!task;

  const [projectId, setProjectId] = useState(
    task?.project_id ?? prefilledProjectId ?? "",
  );
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [startDate, setStartDate] = useState(
    task?.start_date ?? prefilledDate ?? "",
  );
  const [dueDate, setDueDate] = useState(task?.due_date ?? prefilledDate ?? "");
  const [estimatedHours, setEstimatedHours] = useState(
    task?.estimated_hours ?? "",
  );
  const [status, setStatus] = useState(task?.status ?? "todo");
  const [error, setError] = useState<string | null>(null);

  // Update form when task changes
  useEffect(() => {
    if (task) {
      setProjectId(task.project_id ?? "");
      setTitle(task.title);
      setDescription(task.description ?? "");
      setStartDate(task.start_date ?? "");
      setDueDate(task.due_date ?? "");
      setEstimatedHours(task.estimated_hours ?? "");
      setStatus(task.status);
    } else {
      setProjectId(prefilledProjectId ?? "");
      setTitle("");
      setDescription("");
      setStartDate(prefilledDate ?? "");
      setDueDate(prefilledDate ?? "");
      setEstimatedHours("");
      setStatus("todo");
    }
  }, [task, prefilledDate, prefilledProjectId]);

  const utils = api.useUtils();

  const createTask = api.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      resetForm();
      onClose();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const updateTask = api.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      resetForm();
      onClose();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const resetForm = () => {
    setProjectId(prefilledProjectId ?? "");
    setTitle("");
    setDescription("");
    setStartDate(prefilledDate ?? "");
    setDueDate(prefilledDate ?? "");
    setEstimatedHours("");
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!projectId) {
      setError("Please select a project");
      return;
    }

    if (isEditMode && task) {
      updateTask.mutate({
        id: task.id,
        projectId,
        title,
        description: description || undefined,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
        status,
      });
    } else {
      createTask.mutate({
        projectId,
        title,
        description: description || undefined,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
      });
    }
  };

  const isPending = createTask.isPending || updateTask.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? "Edit Task" : "New Task"}
      anchorElement={anchorElement}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="project"
            className="mb-1 block text-xs font-medium text-gray-700"
          >
            Project
          </label>
          <select
            id="project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
          >
            <option value="">Select project</option>
            {projects?.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="title"
            className="mb-1 block text-xs font-medium text-gray-700"
          >
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
            placeholder="What needs to be done?"
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="mb-1 block text-xs font-medium text-gray-700"
          >
            Notes
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
            rows={2}
            placeholder="Additional details"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label
              htmlFor="dueDate"
              className="mb-1 block text-xs font-medium text-gray-700"
            >
              Due
            </label>
            <input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="estimatedHours"
              className="mb-1 block text-xs font-medium text-gray-700"
            >
              Hours
            </label>
            <input
              id="estimatedHours"
              type="number"
              step="0.5"
              min="0"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
              placeholder="8"
            />
          </div>
        </div>

        {isEditMode && (
          <div>
            <label
              htmlFor="status"
              className="mb-1 block text-xs font-medium text-gray-700"
            >
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
            >
              <option value="todo">Todo</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded-md bg-gray-900 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {isPending ? (isEditMode ? "Saving..." : "Creating...") : (isEditMode ? "Save" : "Create")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
