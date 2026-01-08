// src/app/_components/navbar.tsx
import Link from "next/link";
import { createClient } from "import-alias/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";

export async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
            {user ? (
              <>
                <span className="text-sm text-gray-700">
                  {user.email}
                </span>
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
