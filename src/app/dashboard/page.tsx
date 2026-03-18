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
    <div className="relative min-h-screen" style={{ background: "#0a0a0f" }}>
      <div className="px-6 pt-6 pb-2">
        <h1 className="font-mono text-2xl font-light tracking-[0.15em] text-white/80">
          Orbital
        </h1>
        <p className="font-mono text-xs tracking-wider text-white/25">
          Radial time-horizon task map — your tasks in orbit
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
    <div
      className="flex min-h-[60vh] items-center justify-center"
      style={{ background: "#0a0a0f" }}
    >
      <div className="font-mono text-xs tracking-wider text-white/20">
        Initializing orbital field...
      </div>
    </div>
  );
}
