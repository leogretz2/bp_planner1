import { Suspense } from "react";
import { DashboardContent } from "./_components/dashboard-content";
import { createClient } from "import-alias/lib/supabase/server";
import { db } from "import-alias/server/db";
import { users } from "import-alias/server/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  // Get authenticated user
  const supabase = await createClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser) {
    redirect("/auth/sign-in");
  }

  // Get user from database, or create if doesn't exist
  let [currentUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, supabaseUser.id))
    .limit(1);

  if (!currentUser) {
    // Auto-create user in Drizzle database (synced from Supabase auth)
    [currentUser] = await db
      .insert(users)
      .values({
        id: supabaseUser.id,
        email: supabaseUser.email!,
        display_name:
          supabaseUser.user_metadata?.display_name ??
          supabaseUser.email?.split("@")[0] ??
          "User",
        avatar_url: supabaseUser.user_metadata?.avatar_url ?? null,
        role: "member", // Default role
      })
      .returning();
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Tasks
        </h1>
        <p className="mt-1 text-gray-600">
          Weekly view of your tasks and projects
        </p>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent currentUser={currentUser} />
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 bg-gray-200 rounded animate-pulse" />
      <div className="h-96 bg-gray-200 rounded animate-pulse" />
    </div>
  );
}
