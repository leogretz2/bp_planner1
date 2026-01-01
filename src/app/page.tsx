import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
          Task <span className="text-[hsl(280,100%,70%)]">Planner</span>
        </h1>

        <p className="text-xl text-gray-300">
          Organize your projects, tasks, and team collaboration
        </p>

        <div className="flex gap-4">
          <Link
            href="/dashboard"
            className="rounded-lg bg-white/10 px-10 py-4 font-semibold text-white transition hover:bg-white/20"
          >
            Go to Dashboard →
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-8">
          <div className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4">
            <h3 className="text-2xl font-bold">📅 Week View</h3>
            <div className="text-sm">
              See your tasks organized by day and project
            </div>
          </div>
          <div className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4">
            <h3 className="text-2xl font-bold">🎯 Task Tracking</h3>
            <div className="text-sm">
              Monitor task status, assignments, and deadlines
            </div>
          </div>
          <div className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4">
            <h3 className="text-2xl font-bold">👥 Team Collaboration</h3>
            <div className="text-sm">
              Organize work across pods and projects
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
