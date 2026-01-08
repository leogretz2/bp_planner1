"use client";

import { createClient } from "import-alias/lib/supabase/client";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <button
      onClick={handleSignOut}
      className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
    >
      Sign Out
    </button>
  );
}
