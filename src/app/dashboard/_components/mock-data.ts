// Mock data for prototype development
export interface MockTask {
  id: string;
  title: string;
  project_id: string;
  status: "todo" | "in_progress" | "done" | "blocked";
  priority: number;
  due_date: string | null;
  start_date: string | null;
  estimated_hours: number | null;
  description: string | null;
  created_by: string;
}

export interface MockProject {
  id: string;
  name: string;
  status: "active" | "archived";
  description: string | null;
}

const today = new Date();
const fmt = (d: Date) => d.toISOString().split("T")[0];
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

export const MOCK_PROJECTS: MockProject[] = [
  { id: "p1", name: "Brand Refresh", status: "active", description: "Complete brand identity overhaul" },
  { id: "p2", name: "Mobile App v2", status: "active", description: "Redesign mobile experience" },
  { id: "p3", name: "Design System", status: "active", description: "Component library and tokens" },
];

export const MOCK_TASKS: MockTask[] = [
  { id: "t1", title: "Finalize logo variations", project_id: "p1", status: "in_progress", priority: 1, due_date: fmt(today), start_date: fmt(addDays(today, -2)), estimated_hours: 3, description: "Explore 3 directions: minimal wordmark, abstract symbol, combination", created_by: "u1" },
  { id: "t2", title: "Review type scale", project_id: "p3", status: "todo", priority: 2, due_date: fmt(today), start_date: fmt(today), estimated_hours: 1, description: "Check heading/body ratio against WCAG", created_by: "u1" },
  { id: "t3", title: "Push notification flow", project_id: "p2", status: "in_progress", priority: 1, due_date: fmt(today), start_date: fmt(addDays(today, -1)), estimated_hours: 4, description: "Map out permission request → notification → deep link flow", created_by: "u1" },
  { id: "t4", title: "Color palette exploration", project_id: "p1", status: "todo", priority: 2, due_date: fmt(addDays(today, 2)), start_date: fmt(addDays(today, 1)), estimated_hours: 5, description: null, created_by: "u1" },
  { id: "t5", title: "Onboarding screens", project_id: "p2", status: "todo", priority: 3, due_date: fmt(addDays(today, 3)), start_date: fmt(addDays(today, 2)), estimated_hours: 6, description: "3-screen onboarding with illustrations", created_by: "u1" },
  { id: "t6", title: "Button component specs", project_id: "p3", status: "in_progress", priority: 2, due_date: fmt(addDays(today, 4)), start_date: fmt(addDays(today, -1)), estimated_hours: 3, description: null, created_by: "u1" },
  { id: "t7", title: "Brand guidelines doc", project_id: "p1", status: "blocked", priority: 3, due_date: fmt(addDays(today, 5)), start_date: null, estimated_hours: 8, description: "Waiting on final assets from photography team", created_by: "u1" },
  { id: "t8", title: "App store assets", project_id: "p2", status: "todo", priority: 3, due_date: fmt(addDays(today, 10)), start_date: fmt(addDays(today, 8)), estimated_hours: 4, description: null, created_by: "u1" },
  { id: "t9", title: "Icon set — 48 icons", project_id: "p3", status: "todo", priority: 2, due_date: fmt(addDays(today, 14)), start_date: fmt(addDays(today, 10)), estimated_hours: 12, description: null, created_by: "u1" },
  { id: "t10", title: "Social media templates", project_id: "p1", status: "todo", priority: 4, due_date: fmt(addDays(today, 12)), start_date: null, estimated_hours: 6, description: null, created_by: "u1" },
  { id: "t11", title: "Navigation redesign", project_id: "p2", status: "todo", priority: 2, due_date: fmt(addDays(today, 18)), start_date: fmt(addDays(today, 14)), estimated_hours: 8, description: null, created_by: "u1" },
  { id: "t12", title: "Motion design system", project_id: "p3", status: "todo", priority: 3, due_date: fmt(addDays(today, 25)), start_date: null, estimated_hours: 15, description: null, created_by: "u1" },
  { id: "t13", title: "Merch design concepts", project_id: "p1", status: "todo", priority: 5, due_date: fmt(addDays(today, 30)), start_date: null, estimated_hours: 10, description: null, created_by: "u1" },
  { id: "t14", title: "Accessibility audit", project_id: "p2", status: "todo", priority: 2, due_date: fmt(addDays(today, 28)), start_date: null, estimated_hours: 6, description: null, created_by: "u1" },
  { id: "t15", title: "Dark mode tokens", project_id: "p3", status: "todo", priority: 3, due_date: fmt(addDays(today, 21)), start_date: null, estimated_hours: 4, description: null, created_by: "u1" },
  { id: "t16", title: "Competitor analysis", project_id: "p1", status: "todo", priority: 4, due_date: null, start_date: null, estimated_hours: 3, description: null, created_by: "u1" },
  { id: "t17", title: "User testing plan", project_id: "p2", status: "todo", priority: 3, due_date: null, start_date: null, estimated_hours: 2, description: null, created_by: "u1" },
  { id: "t18", title: "Spacing scale review", project_id: "p3", status: "done", priority: 3, due_date: fmt(addDays(today, -1)), start_date: fmt(addDays(today, -3)), estimated_hours: 2, description: null, created_by: "u1" },
  { id: "t19", title: "Stationery mockups", project_id: "p1", status: "done", priority: 4, due_date: fmt(addDays(today, -2)), start_date: fmt(addDays(today, -4)), estimated_hours: 5, description: null, created_by: "u1" },
  { id: "t20", title: "Splash screen animation", project_id: "p2", status: "done", priority: 2, due_date: fmt(addDays(today, -1)), start_date: fmt(addDays(today, -3)), estimated_hours: 4, description: null, created_by: "u1" },
];

export const PROJECT_COLORS: Record<string, { accent: string; border: string; bg: string; text: string }> = {
  p1: { accent: "#2D2A1E", border: "#D4C98A", bg: "#FAF7ED", text: "#5C572E" },  // Warm parchment/gold
  p2: { accent: "#1A2A2E", border: "#8AB5C9", bg: "#EDF5F8", text: "#2E5C6E" },  // Cool slate/blue
  p3: { accent: "#2E1A2A", border: "#C98AB5", bg: "#F8EDF5", text: "#6E2E5C" },  // Dusty rose
};
