# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

A task/project planner app built with the T3 Stack (create-t3-app). Target audience is designers. Uses Supabase for auth and PostgreSQL hosting, Drizzle ORM for database access, tRPC for the API layer.

## Commands

- `pnpm dev` — start dev server (Next.js with Turbopack)
- `pnpm build` — production build
- `pnpm check` — lint + typecheck combined
- `pnpm lint` / `pnpm lint:fix` — ESLint
- `pnpm typecheck` — TypeScript type checking (`tsc --noEmit`)
- `pnpm format:check` / `pnpm format:write` — Prettier
- `pnpm db:generate` — generate Drizzle migrations from schema changes
- `pnpm db:migrate` — run migrations (via `tsx scripts/run-migrations.ts`)
- `pnpm db:push` — push schema directly to DB (dev shortcut, skips migration files)
- `pnpm db:seed` — seed the database
- `pnpm db:studio` — open Drizzle Studio GUI
- `pnpm db:check` — check DB state (`tsx scripts/check-db-state.ts`)
- `pnpm db:reset` — reset database (`tsx scripts/reset-db.ts`)

### Utility Scripts (run via `pnpm tsx scripts/<name>.ts`)

- `promote-to-admin.ts <email>` — promote a user to admin role
- `check-users.ts` — inspect users in the database

## Architecture

### Stack

- **Next.js 15** (App Router, React 19, Turbopack)
- **tRPC 11** — end-to-end typesafe API
- **Drizzle ORM** — PostgreSQL via `postgres` driver
- **Supabase** — auth (email/password) and DB hosting
- **Tailwind CSS v4** — utility-first styling, no component library
- **Framer Motion** — animations
- **Zod** — runtime validation on tRPC inputs

### Path Alias

`import-alias/*` maps to `./src/*` (configured in tsconfig.json). All internal imports use this alias.

### Environment Variables

Validated via `@t3-oss/env-nextjs` in `src/env.js`. Required vars: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Skip validation with `SKIP_ENV_VALIDATION=1`.

### tRPC Layer

- Context (`src/server/api/trpc.ts`): auto-resolves Supabase session and syncs user to Drizzle `users` table on every request. Provides `db`, `user`, `supabaseUser` in context.
- Two procedure types: `publicProcedure` (unauthenticated, with timing middleware) and `protectedProcedure` (requires auth, `ctx.user` guaranteed non-null).
- Routers in `src/server/api/routers/` — tasks, projects, users.
- App router: `src/server/api/root.ts`.

### Database

- Schema: `src/server/db/schema.ts` (Drizzle ORM, PostgreSQL)
- Tables are **not** prefixed in code but filtered by `planner1_*` in drizzle.config.ts
- Key entities: users, pods, projects, tasks, tags, task_tags, task_assignments, work_logs, notifications
- Migrations output to `./migrations/`

### Auth Flow

- Supabase client created via `src/lib/supabase/server.ts` (server) and `src/lib/supabase/client.ts` (browser)
- Auth middleware in `src/middleware.ts`
- Sign-in at `/auth/sign-in`, callback at `/auth/callback`
- Users auto-created in Drizzle DB on first authenticated tRPC request

### Frontend

- App Router pages: `/` (landing), `/dashboard` (main app), `/auth/*`
- Dashboard components in `src/app/dashboard/_components/` — week-view grid (projects × days), task cards, create/edit modal
- Shared components in `src/app/_components/` (navbar, sign-out)
- tRPC client hooks via `src/trpc/react.tsx`
- No UI component library — custom Tailwind components throughout
