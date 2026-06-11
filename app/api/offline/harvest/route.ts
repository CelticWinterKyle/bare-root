import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addHarvestLog } from "@/app/actions/tracking";

/**
 * Replay target for offline-queued harvest logs. Thin wrapper over the
 * canonical addHarvestLog action (auth, ownership, actualHarvestDate
 * backfill, clientId idempotency all live there) — exists because queue
 * replay uses plain fetch, not a server-action invocation.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  let body: {
    clientId?: string;
    plantingId?: string;
    quantity?: number;
    unit?: string;
    notes?: string;
    harvestedAt?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  const quantity = Number(body.quantity);
  if (
    !body.clientId ||
    typeof body.clientId !== "string" ||
    body.clientId.length > 64 ||
    !body.plantingId ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > 100000 ||
    !body.unit ||
    typeof body.unit !== "string"
  ) {
    return new NextResponse("Bad request", { status: 400 });
  }

  try {
    await addHarvestLog(body.plantingId, {
      quantity,
      unit: body.unit.slice(0, 20),
      notes: typeof body.notes === "string" ? body.notes.slice(0, 500) : undefined,
      harvestedAt: body.harvestedAt,
      clientId: body.clientId,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    // "Planting not found" = removed while offline; tell the client to
    // drop the queue entry rather than retry forever.
    if (err instanceof Error && err.message === "Planting not found") {
      return NextResponse.json({ ok: false, drop: true }, { status: 410 });
    }
    console.error("offline harvest replay failed:", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
