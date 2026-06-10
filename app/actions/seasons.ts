"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenEditFilter } from "@/lib/permissions";
import { seasonInputSchema, MAX_CARRY_OVER_PLANTINGS } from "@/lib/validation";
import { assignPlant } from "@/app/actions/planting";

export async function createSeason(
  gardenId: string,
  input: { name: string; startDate: string; endDate?: string; setActive: boolean }
) {
  const user = await requireUser();

  const parsed = seasonInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid season");
  }
  const data = parsed.data;

  const garden = await db.garden.findFirst({
    where: { id: gardenId, ...gardenEditFilter(user.id) },
  });
  if (!garden) throw new Error("Garden not found");

  await db.$transaction(async (tx) => {
    if (data.setActive) {
      await tx.season.updateMany({ where: { gardenId }, data: { isActive: false } });
    }
    await tx.season.create({
      data: {
        gardenId,
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        isActive: data.setActive,
      },
    });
  });

  revalidatePath(`/garden/${gardenId}`);
  revalidatePath(`/garden/${gardenId}/seasons`);
}

/**
 * Create a season AND replant last season's grow-again picks into it.
 *
 * "Last season" is the most recent season that exists at call time (by
 * startDate). Its plantings with growAgain=true are re-created as PLANNED
 * plantings anchored on the SAME cells, via the canonical assignPlant path —
 * so footprints, occupancy checks, tier limits, and reminders all behave
 * exactly like a hand-placed plant. The variety string is carried over.
 *
 * Carry-over is best-effort: the season itself is committed first, then each
 * replant runs serially (later footprints must see earlier ones as occupied).
 * A planting whose old spot can't be used — footprint of an earlier carry
 * took the anchor, bed no longer writable on the current tier, etc. — is
 * counted in `skipped`, never fails the whole call. Anything beyond the
 * MAX_CARRY_OVER_PLANTINGS cap is also counted as skipped.
 */
export async function createSeasonWithCarryOver(
  gardenId: string,
  input: { name: string; startDate: string; endDate?: string; setActive: boolean }
): Promise<{ carried: number; skipped: number }> {
  const user = await requireUser();

  const parsed = seasonInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid season");
  }
  const data = parsed.data;

  const garden = await db.garden.findFirst({
    where: { id: gardenId, ...gardenEditFilter(user.id) },
  });
  if (!garden) throw new Error("Garden not found");

  // Snapshot the previous season's grow-again picks BEFORE creating the new
  // season, so "most recent season" can't resolve to the one we're making.
  const prevSeason = await db.season.findFirst({
    where: { gardenId },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  const [growAgainTotal, toCarry] = prevSeason
    ? await Promise.all([
        db.planting.count({ where: { seasonId: prevSeason.id, growAgain: true } }),
        db.planting.findMany({
          where: { seasonId: prevSeason.id, growAgain: true },
          select: { cellId: true, plantId: true, variety: true },
          orderBy: { createdAt: "asc" },
          take: MAX_CARRY_OVER_PLANTINGS,
        }),
      ])
    : [0, []];

  const newSeason = await db.$transaction(async (tx) => {
    if (data.setActive) {
      await tx.season.updateMany({ where: { gardenId }, data: { isActive: false } });
    }
    return tx.season.create({
      data: {
        gardenId,
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        isActive: data.setActive,
      },
    });
  });

  let carried = 0;
  let skipped = growAgainTotal - toCarry.length; // over-cap remainder

  // Serial, like bulkAssignPlant — a later plant's footprint resolution must
  // see earlier placements as occupied, or overlapping pairs would race.
  for (const p of toCarry) {
    try {
      await assignPlant(p.cellId, p.plantId, newSeason.id);
      if (p.variety) {
        await db.planting.update({
          where: { cellId_seasonId: { cellId: p.cellId, seasonId: newSeason.id } },
          data: { variety: p.variety },
        });
      }
      carried++;
    } catch (err) {
      // Expected when an earlier carry's footprint claimed this anchor —
      // surface as skipped, not failure.
      skipped++;
      console.warn(
        `createSeasonWithCarryOver: cell ${p.cellId} skipped:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  revalidatePath(`/garden/${gardenId}`);
  revalidatePath(`/garden/${gardenId}/seasons`);
  return { carried, skipped };
}

export async function setActiveSeason(seasonId: string) {
  const user = await requireUser();

  const season = await db.season.findFirst({
    where: { id: seasonId, garden: gardenEditFilter(user.id) },
  });
  if (!season) throw new Error("Season not found");

  await db.$transaction([
    db.season.updateMany({ where: { gardenId: season.gardenId }, data: { isActive: false } }),
    db.season.update({ where: { id: seasonId }, data: { isActive: true } }),
  ]);

  revalidatePath(`/garden/${season.gardenId}`);
  revalidatePath(`/garden/${season.gardenId}/seasons`);
}

export async function archiveSeason(seasonId: string) {
  const user = await requireUser();

  const season = await db.season.findFirst({
    where: { id: seasonId, garden: gardenEditFilter(user.id) },
  });
  if (!season) throw new Error("Season not found");

  await db.season.update({ where: { id: seasonId }, data: { isActive: false, endDate: new Date() } });

  revalidatePath(`/garden/${season.gardenId}`);
  revalidatePath(`/garden/${season.gardenId}/seasons`);
}

export async function ratePlanting(
  plantingId: string,
  data: { rating: number | null; growAgain: boolean | null }
) {
  const user = await requireUser();

  const planting = await db.planting.findFirst({
    where: { id: plantingId, cell: { bed: { garden: gardenEditFilter(user.id) } } },
    include: { cell: { include: { bed: true } } },
  });
  if (!planting) throw new Error("Planting not found");

  await db.planting.update({ where: { id: plantingId }, data });

  revalidatePath(`/garden/${planting.cell.bed.gardenId}/seasons`);
}
