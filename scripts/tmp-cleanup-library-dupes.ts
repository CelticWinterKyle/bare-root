/* Library cleanup: the perenual import left duplicate + lowercase rows
   next to the curated seed catalog ("carrot" beside "Carrot", five
   "tomato"s, etc.).

   1. Perenual rows whose name matches a curated row (case-insensitive):
      re-point any references to the curated row, then delete.
   2. Perenual rows duplicating each other: keep one per name (prefer an
      imaged row), re-point refs, delete the rest.
   3. Remaining perenual rows with lowercase names: rename to title case.

   Run:  npx tsx --env-file=.env.local scripts/tmp-cleanup-library-dupes.ts        (dry run)
         APPLY=1 npx tsx --env-file=.env.local scripts/tmp-cleanup-library-dupes.ts (execute)
*/
import { db } from "../lib/db";

const APPLY = process.env.APPLY === "1";
const SMALL_WORDS = new Set(["of", "in", "the", "and", "a", "an", "with"]);

function titleCase(name: string): string {
  return name
    .split(" ")
    .map((w, i) =>
      i > 0 && SMALL_WORDS.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)
    )
    .join(" ");
}

async function repointAndDelete(fromId: string, toId: string, label: string) {
  console.log(`  ${APPLY ? "MERGING" : "would merge"} ${label} -> ${toId}`);
  if (!APPLY) return;
  await db.$transaction([
    db.planting.updateMany({ where: { plantId: fromId }, data: { plantId: toId } }),
    db.seedInventory.updateMany({ where: { plantId: fromId }, data: { plantId: toId } }),
    db.templateAssignment.updateMany({ where: { plantId: fromId }, data: { plantId: toId } }),
    // CompanionRelations cascade on delete; a relation duplicated on the
    // keeper would violate @@unique, so drop rather than re-point them.
    db.plantLibrary.delete({ where: { id: fromId } }),
  ]);
}

async function main() {
  const all = await db.plantLibrary.findMany({
    select: {
      id: true, name: true, source: true, imageUrl: true, createdAt: true,
      _count: { select: { plantings: true, seedInventory: true, templateAssignments: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const refs = (p: (typeof all)[number]) =>
    p._count.plantings + p._count.seedInventory + p._count.templateAssignments;

  // 1. perenual duplicating curated
  const curatedByName = new Map(
    all.filter((p) => p.source !== "perenual").map((p) => [p.name.trim().toLowerCase(), p])
  );
  let merged = 0;
  for (const p of all.filter((x) => x.source === "perenual")) {
    const curated = curatedByName.get(p.name.trim().toLowerCase());
    if (!curated) continue;
    await repointAndDelete(p.id, curated.id, `"${p.name}" (${p.id}, refs=${refs(p)})`);
    merged++;
  }

  // 2. perenual duplicating perenual
  const survivors = all.filter(
    (p) => p.source === "perenual" && !curatedByName.has(p.name.trim().toLowerCase())
  );
  const groups = new Map<string, typeof survivors>();
  for (const p of survivors) {
    const k = p.name.trim().toLowerCase();
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  let deduped = 0;
  for (const [, group] of groups) {
    if (group.length < 2) continue;
    const keeper = [...group].sort(
      (a, b) => (b.imageUrl ? 1 : 0) - (a.imageUrl ? 1 : 0) || refs(b) - refs(a)
    )[0];
    for (const p of group) {
      if (p.id === keeper.id) continue;
      await repointAndDelete(p.id, keeper.id, `dup "${p.name}" (${p.id}, refs=${refs(p)})`);
      deduped++;
    }
  }

  // 3. title-case what's left
  const kept = new Set([
    ...survivors.filter((p) => ![...groups.values()].some((g) => g.length > 1 && g.some((x) => x.id === p.id && x.id !== [...g].sort((a, b) => (b.imageUrl ? 1 : 0) - (a.imageUrl ? 1 : 0) || refs(b) - refs(a))[0].id))).map((p) => p.id),
  ]);
  let renamed = 0;
  for (const p of survivors) {
    if (!kept.has(p.id)) continue;
    const fixed = titleCase(p.name.trim());
    if (fixed === p.name) continue;
    console.log(`  ${APPLY ? "RENAMING" : "would rename"} "${p.name}" -> "${fixed}"`);
    if (APPLY) await db.plantLibrary.update({ where: { id: p.id }, data: { name: fixed } });
    renamed++;
  }

  console.log(`\n${APPLY ? "done" : "dry run"}: merged=${merged} deduped=${deduped} renamed=${renamed}`);
}
main().finally(() => db.$disconnect());
