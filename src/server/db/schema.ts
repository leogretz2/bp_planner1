// src/server/db/schema.ts
// Drizzle ORM schema for planner app
import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
  date,
  uniqueIndex,
  integer,
  serial,
  primaryKey,
} from "drizzle-orm/pg-core";

/**
 * Users table (if you use Supabase Auth, map auth.users -> profiles but this standalone table is fine for now)
 */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  display_name: text("display_name"),
  avatar_url: text("avatar_url"),
  role: text("role").notNull().default("member"), // member | manager | admin
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/**
 * Pods (group)
 */
export const pods = pgTable("pods", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  manager_id: uuid("manager_id").references(() => users.id),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/**
 * Projects
 */
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  pod_id: uuid("pod_id").references(() => pods.id),
  status: text("status").notNull().default("active"), // active | archived
  start_date: date("start_date"),
  end_date: date("end_date"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/**
 * Tags
 */
export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
});

/**
 * Tasks
 */
export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  project_id: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"), // todo|in_progress|done|blocked
  priority: integer("priority").default(3),
  created_by: uuid("created_by").references(() => users.id),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  start_date: date("start_date"),
  due_date: date("due_date"),
  estimated_hours: numeric("estimated_hours"),
});

/**
 * Task ↔ Tag many-to-many
 */
export const task_tags = pgTable(
  "task_tags",
  {
    task_id: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    tag_id: uuid("tag_id").references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey(t.task_id, t.tag_id),
  })
);

/**
 * Assignments: which user is assigned to which task and planned day
 */
export const task_assignments = pgTable("task_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  task_id: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("assignee"), // owner|assignee|reviewer
  planned_day: date("planned_day"),
  estimated_hours: numeric("estimated_hours"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/**
 * Work logs (time tracking)
 */
export const work_logs = pgTable("work_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  task_id: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  started_at: timestamp("started_at", { withTimezone: true }),
  ended_at: timestamp("ended_at", { withTimezone: true }),
  delta_hours: numeric("delta_hours"),
  notes: text("notes"),
});

/**
 * Notifications table (queued)
 */
export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  payload: text("payload").notNull(), // you can switch this to jsonb if needed
  sent: text("sent").default("false"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
