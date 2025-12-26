// src/server/api/routers/users.ts
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
} from "import-alias/server/api/trpc";
import { users } from "import-alias/server/db/schema";
import { eq } from "drizzle-orm";

export const usersRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(users).limit(500);
  }),

  create: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        display_name: z.string().optional(),
        role: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const res = await ctx.db
        .insert(users)
        .values({
          email: input.email,
          display_name: input.display_name ?? null,
          role: input.role ?? "member",
        })
        .returning();
      return res[0];
    }),

  getById: publicProcedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.id, input));
      return row ?? null;
    }),
});
