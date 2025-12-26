// src/server/api/routers/tasks.ts
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
} from "import-alias/server/api/trpc";
import { tasks, task_assignments } from "import-alias/server/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export const tasksRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z
        .object({
          projectId: z.string().uuid().optional(),
          assigneeId: z.string().uuid().optional(),
          status: z.array(z.string()).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const q = ctx.db
        .select()
        .from(tasks)
        .where(
          and(
            input?.projectId
              ? eq(tasks.project_id, input.projectId)
              : undefined,
            input?.status ? inArray(tasks.status, input.status) : undefined,
          ),
        );
      return await q.limit(500);
    }),

  create: publicProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        title: z.string().min(1),
        description: z.string().optional(),
        startDate: z.string().date().optional(),
        dueDate: z.string().date().optional(),
        estimatedHours: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // DEBUG - add back with supabase authentication
      //   if (!ctx.user) throw new Error("Unauthorized");
      const [created] = await ctx.db
        .insert(tasks)
        .values({
          project_id: input.projectId,
          title: input.title,
          description: input.description ?? null,
          start_date: input.startDate ?? null,
          due_date: input.dueDate ?? null,
          estimated_hours:
            input.estimatedHours != null
              ? input.estimatedHours.toString()
              : null,
          // DEBUG - omit until supabase auth - created_by is nullable created_by: ctx.user.id,
        })
        .returning();
      return created;
    }),

  assignTask: publicProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        userId: z.string().uuid(),
        role: z.string().default("assignee"),
        plannedDay: z.string().date().optional(),
        estimatedHours: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [assn] = await ctx.db
        .insert(task_assignments)
        .values({
          task_id: input.taskId,
          user_id: input.userId,
          role: input.role,
          planned_day: input.plannedDay ?? null,
          estimated_hours:
            input.estimatedHours != null
              ? input.estimatedHours.toString()
              : null,
        })
        .returning();
      return assn;
    }),

  updateStatus: publicProcedure
    .input(z.object({ taskId: z.string().uuid(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(tasks)
        .set({ status: input.status })
        .where(eq(tasks.id, input.taskId));
      const [updated] = await ctx.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, input.taskId));
      return updated;
    }),
});
