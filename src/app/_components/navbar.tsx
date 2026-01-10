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
    <nav className="border-b border-gray-200 bg-white">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-semibold tracking-tight text-gray-900">
              Planner
            </Link>
            <Link href="/dashboard" className="text-sm text-gray-600 transition hover:text-gray-900">
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
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                      {user.role}
                    </span>
                  </>
                )}
                <SignOutButton />
              </>
            ) : (
              <Link
                href="/auth/sign-in"
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
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
