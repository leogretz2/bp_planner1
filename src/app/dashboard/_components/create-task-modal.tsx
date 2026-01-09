"use client";

import { useState } from "react";
import { api } from "import-alias/trpc/react";
import { Modal } from "./modal";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "import-alias/server/api/root";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Project = RouterOutputs["projects"]["list"][number];

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  prefilledDate?: string; // YYYY-MM-DD
  prefilledProjectId?: string;
  anchorElement?: HTMLElement | null;
}

export function CreateTaskModal({
  isOpen,
  onClose,
  projects,
  prefilledDate,
  prefilledProjectId,
  anchorElement,
}: CreateTaskModalProps) {
  const [projectId, setProjectId] = useState(prefilledProjectId ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(prefilledDate ?? "");
  const [dueDate, setDueDate] = useState(prefilledDate ?? "");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [error, setError] = useState<string | null>(null);

  const utils = api.useUtils();
  const createTask = api.tasks.create.useMutation({
    onSuccess: () => {
      // Refresh task list
      utils.tasks.list.invalidate();
      // Reset form
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

    createTask.mutate({
      projectId,
      title,
      description: description || undefined,
      startDate: startDate || undefined,
      dueDate: dueDate || undefined,
      estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Task"
      anchorElement={anchorElement}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="rounded bg-red-50 p-2 text-xs text-red-800">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="project" className="mb-1 block text-xs font-medium text-gray-700">
            Project
          </label>
          <select
            id="project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
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
          <label htmlFor="title" className="mb-1 block text-xs font-medium text-gray-700">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
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
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
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
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
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
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="8"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={createTask.isPending}
            className="flex-1 rounded bg-gray-900 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {createTask.isPending ? "Creating..." : "Create"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-3 py-2 text-sm font-medium transition hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
