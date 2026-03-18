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
        role: "member",
      })
      .returning();
  }

  return (
    <Suspense fallback={<TerminalLoading />}>
      <DashboardContent currentUser={currentUser} />
    </Suspense>
  );
}

function TerminalLoading() {
  return (
    <div
      className="flex h-screen w-screen items-center justify-center font-mono"
      style={{ background: "#0D0D0D", color: "#555" }}
    >
      Loading...
    </div>
  );
}
