import type { Metadata } from "next";
import { OfflineClient } from "@/components/offline/OfflineClient";

export const metadata: Metadata = { title: "Offline · Bare Root" };

/**
 * The offline garden view. Deliberately renders NOTHING server-side — the
 * client component reads the IndexedDB snapshot, so the service worker's
 * cached copy of this page works with no network at all. The SW falls back
 * to this page for any failed navigation.
 */
export default function OfflinePage() {
  return <OfflineClient />;
}
