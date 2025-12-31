// src/server/db/seed.ts
/**
 * Database seed script
 * Run with: pnpm db:seed
 */
import "dotenv/config"; // Load .env file before importing anything else
import { db } from "./index";
import { users, pods, projects, tasks, tags, task_assignments, task_tags } from "./schema";

async function seed() {
  console.log("🌱 Seeding database...");

  try {
    // 1. Create users
    console.log("Creating users...");
    const [alice, bob, carol, dave] = await db
      .insert(users)
      .values([
        {
          email: "alice@example.com",
          display_name: "Alice Anderson",
          role: "admin",
        },
        {
          email: "bob@example.com",
          display_name: "Bob Builder",
          role: "manager",
        },
        {
          email: "carol@example.com",
          display_name: "Carol Chen",
          role: "member",
        },
        {
          email: "dave@example.com",
          display_name: "Dave Davis",
          role: "member",
        },
      ])
      .returning();

    console.log(`✅ Created ${4} users`);

    // 2. Create pods
    console.log("Creating pods...");
    const [engineeringPod, designPod] = await db
      .insert(pods)
      .values([
        {
          name: "Engineering Pod",
          manager_id: bob!.id,
        },
        {
          name: "Design Pod",
          manager_id: alice!.id,
        },
      ])
      .returning();

    console.log(`✅ Created ${2} pods`);

    // 3. Create projects
    console.log("Creating projects...");
    const [project1, project2, project3] = await db
      .insert(projects)
      .values([
        {
          name: "Task Planner App",
          description: "Build a comprehensive task planning and tracking application",
          pod_id: engineeringPod!.id,
          status: "active",
          start_date: "2025-01-01",
          end_date: "2025-06-30",
        },
        {
          name: "Website Redesign",
          description: "Redesign company website with modern UI/UX",
          pod_id: designPod!.id,
          status: "active",
          start_date: "2025-02-01",
          end_date: "2025-04-30",
        },
        {
          name: "Legacy System Migration",
          description: "Migrate old database to new architecture",
          pod_id: engineeringPod!.id,
          status: "archived",
          start_date: "2024-09-01",
          end_date: "2024-12-31",
        },
      ])
      .returning();

    console.log(`✅ Created ${3} projects`);

    // 4. Create tags
    console.log("Creating tags...");
    const [bugTag, featureTag, docTag, urgentTag] = await db
      .insert(tags)
      .values([
        { slug: "bug", label: "Bug" },
        { slug: "feature", label: "Feature" },
        { slug: "documentation", label: "Documentation" },
        { slug: "urgent", label: "Urgent" },
      ])
      .returning();

    console.log(`✅ Created ${4} tags`);

    // 5. Create tasks
    console.log("Creating tasks...");
    const [task1, task2, task3, task4, task5, task6] = await db
      .insert(tasks)
      .values([
        {
          project_id: project1!.id,
          title: "Set up database schema",
          description: "Design and implement the database schema for the planner app",
          status: "done",
          priority: 1,
          created_by: bob!.id,
          start_date: "2025-01-02",
          due_date: "2025-01-10",
          estimated_hours: "16",
        },
        {
          project_id: project1!.id,
          title: "Build API endpoints",
          description: "Create tRPC routers for users, projects, and tasks",
          status: "in_progress",
          priority: 1,
          created_by: bob!.id,
          start_date: "2025-01-11",
          due_date: "2025-01-25",
          estimated_hours: "40",
        },
        {
          project_id: project1!.id,
          title: "Design UI components",
          description: "Create reusable React components for the app",
          status: "todo",
          priority: 2,
          created_by: alice!.id,
          start_date: "2025-01-20",
          due_date: "2025-02-15",
          estimated_hours: "60",
        },
        {
          project_id: project2!.id,
          title: "Create design system",
          description: "Establish colors, typography, and component library",
          status: "in_progress",
          priority: 1,
          created_by: alice!.id,
          start_date: "2025-02-01",
          due_date: "2025-02-20",
          estimated_hours: "30",
        },
        {
          project_id: project2!.id,
          title: "Homepage redesign",
          description: "Redesign the homepage with new branding",
          status: "todo",
          priority: 2,
          created_by: alice!.id,
          start_date: "2025-02-21",
          due_date: "2025-03-15",
          estimated_hours: "24",
        },
        {
          project_id: project1!.id,
          title: "Write API documentation",
          description: "Document all API endpoints and usage examples",
          status: "blocked",
          priority: 3,
          created_by: carol!.id,
          start_date: "2025-01-15",
          due_date: "2025-02-01",
          estimated_hours: "12",
        },
      ])
      .returning();

    console.log(`✅ Created ${6} tasks`);

    // 6. Create task assignments
    console.log("Creating task assignments...");
    await db.insert(task_assignments).values([
      {
        task_id: task2!.id,
        user_id: carol!.id,
        role: "assignee",
        planned_day: "2025-01-15",
        estimated_hours: "8",
      },
      {
        task_id: task2!.id,
        user_id: dave!.id,
        role: "assignee",
        planned_day: "2025-01-16",
        estimated_hours: "8",
      },
      {
        task_id: task3!.id,
        user_id: alice!.id,
        role: "owner",
        planned_day: "2025-01-20",
        estimated_hours: "16",
      },
      {
        task_id: task4!.id,
        user_id: alice!.id,
        role: "owner",
        planned_day: "2025-02-01",
        estimated_hours: "8",
      },
      {
        task_id: task6!.id,
        user_id: carol!.id,
        role: "assignee",
        planned_day: "2025-01-22",
        estimated_hours: "4",
      },
    ]);

    console.log(`✅ Created ${5} task assignments`);

    // 7. Add tags to tasks
    console.log("Adding tags to tasks...");
    await db.insert(task_tags).values([
      { task_id: task1!.id, tag_id: featureTag!.id },
      { task_id: task2!.id, tag_id: featureTag!.id },
      { task_id: task2!.id, tag_id: urgentTag!.id },
      { task_id: task3!.id, tag_id: featureTag!.id },
      { task_id: task4!.id, tag_id: featureTag!.id },
      { task_id: task6!.id, tag_id: docTag!.id },
    ]);

    console.log(`✅ Added tags to tasks`);

    console.log("\n✨ Seeding complete!");
    console.log("\nSummary:");
    console.log("  - 4 users created");
    console.log("  - 2 pods created");
    console.log("  - 3 projects created");
    console.log("  - 4 tags created");
    console.log("  - 6 tasks created");
    console.log("  - 5 task assignments created");
    console.log("  - 6 task-tag relationships created");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

// Run the seed function
seed()
  .then(() => {
    console.log("\n👋 Exiting...");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to seed database:", error);
    process.exit(1);
  });
