"use client";

import { addHarvestLog } from "@/app/actions/tracking";
import { queueHarvest } from "@/lib/offline/db";

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Log a harvest with offline resilience: every attempt carries a fresh
 * clientId (server treats duplicates as success), and a network-level
 * failure queues the log in IndexedDB for OfflineSync to replay instead of
 * losing it. Returns how it landed so the caller can word the toast.
 * Non-network errors (auth, validation) still throw.
 */
export async function logHarvestResilient(args: {
  plantingId: string;
  plantName: string;
  quantity: number;
  unit: string;
  notes?: string;
  harvestedAt?: string;
}): Promise<"synced" | "queued"> {
  const clientId = crypto.randomUUID();
  try {
    await addHarvestLog(args.plantingId, {
      quantity: args.quantity,
      unit: args.unit,
      notes: args.notes,
      harvestedAt: args.harvestedAt,
      clientId,
    });
    return "synced";
  } catch (err) {
    const networkLike = !navigator.onLine || err instanceof TypeError;
    if (!networkLike) throw err;
    await queueHarvest({
      clientId,
      plantingId: args.plantingId,
      plantName: args.plantName,
      quantity: args.quantity,
      unit: args.unit,
      notes: args.notes,
      harvestedAt: args.harvestedAt ?? todayYmd(),
      queuedAt: new Date().toISOString(),
    });
    return "queued";
  }
}
