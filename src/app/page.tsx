import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white">
      <div className="w-full max-w-md text-center">
        <h1 className="mb-8 text-4xl font-bold tracking-tight text-gray-900">
          Task Planner
        </h1>

        <p className="mb-12 text-gray-600">
          Weekly task management for focused execution.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-gray-900 px-6 py-3 font-medium text-white transition hover:bg-gray-800"
          >
            Dashboard
          </Link>
          <Link
            href="/auth/sign-in"
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
