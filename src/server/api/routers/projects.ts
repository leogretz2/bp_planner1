// src/server/api/routers/projects.ts
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
} from "import-alias/server/api/trpc";
import { projects } from "import-alias/server/db/schema";
import { eq } from "drizzle-orm";

export const projectsRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(projects).limit(500);
  }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        pod_id: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const res = await ctx.db
        .insert(projects)
        .values({
          name: input.name,
          description: input.description ?? null,
          pod_id: input.pod_id ?? null,
        })
        .returning();
      return res[0];
    }),

  getById: publicProcedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const [p] = await ctx.db
        .select()
        .from(projects)
        .where(eq(projects.id, input));
      return p ?? null;
    }),
});
