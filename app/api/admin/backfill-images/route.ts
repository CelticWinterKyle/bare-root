import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { sourceAndRehostImage, isBlobUrl } from "@/lib/api/plant-images";

const OWNER_EMAIL = "kyle@celticwinter.com";

// Image downloads + Blob uploads are slow; give the function room.
export const maxDuration = 60;

/**
 * Re-host plant images into Vercel Blob so they stop rotting. Stored Perenual
 * URLs are 24h presigned S3 links (now all expired) and stored Wikimedia
 * thumbnail URLs have gone stale — this fetches a fresh image per plant and
 * saves our own durable copy, then points imageUrl at it.
 *
 * Cursor-paginated by id and time-budgeted, so a single call processes as many
 * plants as fit in ~50s and returns `nextCursor` for the rest. Idempotent: a
 * plant already on Blob is skipped, so re-runs are safe. A plant with no
 * findable image has its rotten URL cleared to null (the UI then shows the
 * category tile instead of a broken image).
 *
 * Triggers:
 *   - GET in a browser while signed in as the owner: `?after=<id>&limit=N`
 *   - POST with header `x-admin-secret: $CRON_SECRET` (scripted/cron use)
 * Repeat with the returned `nextCursor` as `after` until `done` is true.
 */
async function runBackfill(startAfter: string, limit: number) {
  const BUDGET_MS = 50_000;
  const start = Date.now();

  let after = startAfter;
  let processed = 0;
  let rehosted = 0;
  let cleared = 0;
  let skipped = 0;
  const failures: string[] = [];
  let nextCursor: string | null = null;
  let exhausted = false;

  while (Date.now() - start < BUDGET_MS) {
    const plants = await db.plantLibrary.findMany({
      where: { id: { gt: after } },
      orderBy: { id: "asc" },
      take: limit,
      select: { id: true, name: true, imageUrl: true },
    });

    if (plants.length === 0) {
      exhausted = true;
      break;
    }

    for (const p of plants) {
      processed++;
      if (isBlobUrl(p.imageUrl)) {
        skipped++;
        continue;
      }
      const blobUrl = await sourceAndRehostImage(p.id, p.name);
      if (blobUrl) {
        await db.plantLibrary.update({ where: { id: p.id }, data: { imageUrl: blobUrl } });
        rehosted++;
      } else {
        // No durable image available — drop the rotten URL so the UI falls
        // back to the category tile instead of attempting a dead image.
        if (p.imageUrl) {
          await db.plantLibrary.update({ where: { id: p.id }, data: { imageUrl: null } });
          cleared++;
        }
        failures.push(p.name);
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
    rehosted,
    cleared,
    skipped,
    failures,
    nextCursor,
    done: nextCursor === null,
  };
}

function parseParams(req: Request) {
  const { searchParams } = new URL(req.url);
  const after = searchParams.get("after") ?? "";
  const limit = Math.min(40, Math.max(1, Number(searchParams.get("limit") ?? 15)));
  return { after, limit };
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.email.toLowerCase() !== OWNER_EMAIL) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { after, limit } = parseParams(req);
  return NextResponse.json(await runBackfill(after, limit));
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { after, limit } = parseParams(req);
  return NextResponse.json(await runBackfill(after, limit));
}
