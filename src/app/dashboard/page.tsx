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
    <div className="h-screen w-screen overflow-hidden bg-[#0F0F14]">
      <Suspense fallback={<CanvasSkeleton />}>
        <DashboardContent currentUser={currentUser} />
      </Suspense>
    </div>
  );
}

function CanvasSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0F0F14]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-indigo-500" />
        <span className="text-xs text-white/20">Loading canvas...</span>
      </div>
    </div>
  );
}
