"use client";

import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded-full px-3 py-1.5 text-sm text-md-on-surface-variant transition-all duration-200 hover:bg-md-primary/10 hover:text-md-primary"
    >
      Sign out
    </button>
  );
}
