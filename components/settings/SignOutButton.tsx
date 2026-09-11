"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { LogOut, Loader2 } from "lucide-react";
import { clearOfflineData } from "@/lib/offline/db";

/**
 * Sign out, but first wipe the offline snapshot, harvest queue and cached
 * /offline document. Otherwise the next person on this device can open
 * /offline and see the previous user's beds.
 */
export function SignOutButton() {
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      await clearOfflineData();
    } catch {
      // Best-effort: never block sign-out on local storage.
    }
    await signOut();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="flex items-center gap-2 text-sm text-[#B85C3A] hover:text-[#9B4A2E] transition-colors disabled:opacity-60"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
      Sign out
    </button>
  );
}
