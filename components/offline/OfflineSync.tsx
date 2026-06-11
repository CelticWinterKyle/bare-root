"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { setSnapshot, listQueuedHarvests, removeQueuedHarvest } from "@/lib/offline/db";

/**
 * Invisible offline plumbing, mounted once in the app layout:
 *  - while online, refreshes the IndexedDB snapshot the /offline page
 *    renders from (on load and whenever the connection returns);
 *  - replays any queued harvest logs through /api/offline/harvest,
 *    removing entries only on confirmed success (or a 410 "planting
 *    gone" verdict). clientId idempotency makes retries safe.
 */
export function OfflineSync() {
  const running = useRef(false);

  useEffect(() => {
    async function sync() {
      if (running.current || !navigator.onLine) return;
      running.current = true;
      try {
        // 1. Replay queued harvests first so the snapshot reflects them.
        const queued = await listQueuedHarvests();
        let replayed = 0;
        for (const q of queued) {
          try {
            const res = await fetch("/api/offline/harvest", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(q),
            });
            if (res.ok || res.status === 410) {
              await removeQueuedHarvest(q.clientId);
              if (res.ok) replayed++;
            }
            // Other statuses: leave queued for the next pass.
          } catch {
            break; // network dropped mid-replay — try again next time
          }
        }
        if (replayed > 0) {
          toast.success(`Synced ${replayed} harvest${replayed === 1 ? "" : "s"} logged offline`);
        }

        // 2. Refresh the offline snapshot.
        const res = await fetch("/api/offline/snapshot");
        if (res.ok) {
          await setSnapshot(await res.json());
        }

        // 3. Prime the /offline document into the SW cache so the fallback
        //    works even if the user never visited the page while online.
        //    The header tells the SW to cache this as the offline doc.
        await fetch("/offline", { headers: { "x-offline-prime": "1" } }).catch(() => {});
      } catch {
        // Offline plumbing is best-effort by definition.
      } finally {
        running.current = false;
      }
    }

    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, []);

  return null;
}
