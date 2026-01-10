// src/app/_components/navbar.tsx
import Link from "next/link";
import { createClient } from "import-alias/lib/supabase/server";
import { db } from "import-alias/server/db";
import { users } from "import-alias/server/db/schema";
import { eq } from "drizzle-orm";
import { SignOutButton } from "./sign-out-button";

export async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  // Get user from our database if authenticated
  let user = null;
  if (supabaseUser) {
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, supabaseUser.id))
      .limit(1);
    user = dbUser;
  }

  return (
    <nav className="border-b bg-white">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold">
              Planner
            </Link>
            <Link href="/dashboard" className="text-sm hover:text-blue-600">
              Dashboard
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {supabaseUser ? (
              <>
                {user && (
                  <>
                    <span className="text-sm font-medium text-gray-900">
                      {user.display_name}
                    </span>
                    <span className="text-xs rounded-full bg-blue-100 px-2 py-1 text-blue-800">
                      {user.role}
                    </span>
                  </>
                )}
                <SignOutButton />
              </>
            ) : (
              <Link
                href="/auth/sign-in"
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
