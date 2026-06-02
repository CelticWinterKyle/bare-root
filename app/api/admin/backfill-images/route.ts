import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { findPexelsImageUrl, isPexelsUrl } from "@/lib/api/pexels";

const OWNER_EMAIL = "kyle@celticwinter.com";

// Pexels lookups are quick, but give the function room across a batch.
export const maxDuration = 60;

/**
 * Source plant images from Pexels — high-quality, relevant photos on a stable
 * CDN (no expiry / hotlink issues, so we store the URL directly, no Blob).
 *
 * Cursor-paginated by id and time-budgeted, so a single call processes as many
 * plants as fit in ~50s and returns `nextCursor` for the rest. Idempotent:
 * a plant already on a Pexels URL is skipped. A plant Pexels has no match for
 * has its imageUrl cleared to null (the UI then shows the category tile).
 *
 * Pass `?reSource=1` to re-source ALL plants (even ones already on Pexels) —
 * use after improving the query, otherwise leave it off so re-runs are cheap.
 *
 * Triggers:
 *   - GET in a browser while signed in as the owner: `?after=<id>&limit=N`
 *   - POST with header `x-admin-secret: $CRON_SECRET`
 * Repeat with the returned `nextCursor` as `after` until `done` is true.
 */
async function runBackfill(startAfter: string, limit: number, reSource: boolean) {
  const BUDGET_MS = 50_000;
  const start = Date.now();

  let after = startAfter;
  let processed = 0;
  let sourced = 0;
  let cleared = 0;
  let skipped = 0;
  const misses: string[] = [];
  let nextCursor: string | null = null;
  let exhausted = false;

  while (Date.now() - start < BUDGET_MS) {
    const plants = await db.plantLibrary.findMany({
      where: { id: { gt: after } },
      orderBy: { id: "asc" },
      take: limit,
      select: { id: true, name: true, category: true, imageUrl: true },
    });

    if (plants.length === 0) {
      exhausted = true;
      break;
    }

    for (const p of plants) {
      processed++;
      if (!reSource && isPexelsUrl(p.imageUrl)) {
        skipped++;
        continue;
      }
      const url = await findPexelsImageUrl(p.name, p.category);
      if (url) {
        await db.plantLibrary.update({ where: { id: p.id }, data: { imageUrl: url } });
        sourced++;
      } else if (p.imageUrl) {
        // No Pexels match — drop any stale URL so the UI shows the tile.
        await db.plantLibrary.update({ where: { id: p.id }, data: { imageUrl: null } });
        cleared++;
        misses.push(p.name);
      } else {
        misses.push(p.name);
      }
    }

    after = plants[plants.length - 1].id;
    if (plants.length < limit) {
      exhausted = true;
      break;
    }
  }

  if (!exhausted) nextCursor = after;

  return {
    processed,
    sourced,
    cleared,
    skipped,
    misses,
    nextCursor,
    done: nextCursor === null,
  };
}

function parseParams(req: Request) {
  const { searchParams } = new URL(req.url);
  const after = searchParams.get("after") ?? "";
  const limit = Math.min(60, Math.max(1, Number(searchParams.get("limit") ?? 40)));
  const reSource = searchParams.get("reSource") === "1";
  return { after, limit, reSource };
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.email.toLowerCase() !== OWNER_EMAIL) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { after, limit, reSource } = parseParams(req);
  return NextResponse.json(await runBackfill(after, limit, reSource));
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { after, limit, reSource } = parseParams(req);
  return NextResponse.json(await runBackfill(after, limit, reSource));
}
