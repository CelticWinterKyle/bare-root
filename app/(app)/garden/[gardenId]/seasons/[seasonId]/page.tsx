import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenAccessFilter } from "@/lib/permissions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { estimateYieldLbs } from "@/lib/services/yield";
import type { PlantCategory } from "@/lib/generated/prisma/enums";
import { PolaroidImage } from "@/components/dashboard/PolaroidImage";
import styles from "./retrospective.module.css";

function categoryGradient(cat: string | undefined): string {
  switch (cat) {
    case "VEGETABLE":
      return styles.polaroidVeg;
    case "HERB":
      return styles.polaroidHerb;
    case "FRUIT":
      return styles.polaroidFruit;
    case "FLOWER":
      return styles.polaroidFlower;
    default:
      return styles.polaroidOther;
  }
}

function categoryEmoji(cat: string | undefined): string {
  switch (cat) {
    case "VEGETABLE":
      return "🥬";
    case "HERB":
      return "🌿";
    case "FRUIT":
      return "🍅";
    case "FLOWER":
      return "🌸";
    default:
      return "🌱";
  }
}

/** "14.2" — one decimal, trailing zero trimmed. */
function fmtQty(n: number): number {
  return Number(n.toFixed(1));
}

export default async function SeasonSummaryPage({
  params,
}: {
  params: Promise<{ gardenId: string; seasonId: string }>;
}) {
  const { gardenId, seasonId } = await params;
  const user = await requireUser();

  const season = await db.season.findFirst({
    where: { id: seasonId, gardenId, garden: gardenAccessFilter(user.id) },
    include: {
      garden: { select: { name: true } },
      plantings: {
        include: {
          plant: { select: { id: true, name: true, category: true } },
          cell: { include: { bed: { select: { name: true, cellSizeIn: true } } } },
          harvestLogs: true,
          _count: { select: { cells: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!season) notFound();

  // Bounded side queries: a strip of photos for the polaroid wall, and the
  // nearest earlier season's harvest totals for the comparison line.
  const [photos, prevSeason] = await Promise.all([
    db.plantingPhoto.findMany({
      where: { planting: { seasonId: season.id } },
      orderBy: { takenAt: "desc" },
      take: 8,
      include: {
        planting: {
          select: { variety: true, plant: { select: { name: true, category: true } } },
        },
      },
    }),
    db.season.findFirst({
      where: { gardenId, id: { not: season.id }, startDate: { lt: season.startDate } },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    }),
  ]);
  const prevTotals = prevSeason
    ? await db.harvestLog.groupBy({
        by: ["unit"],
        where: { planting: { seasonId: prevSeason.id } },
        _sum: { quantity: true },
      })
    : [];

  // Aggregate harvest by plant
  type PlantSummary = {
    plantId: string;
    plantName: string;
    /** Distinct varieties grown ("Sungold, Roma") — shown after the name. */
    varieties: string[];
    category: string;
    beds: string[];
    totalHarvest: number;
    totalsByUnit: Record<string, number>;
    estYieldLbs: number;
    logCount: number;
    rating: number | null;
    growAgain: boolean | null;
    status: string;
  };

  const byPlant: Record<string, PlantSummary> = {};
  for (const p of season.plantings) {
    const pid = p.plant.id;
    if (!byPlant[pid]) {
      byPlant[pid] = {
        plantId: pid,
        plantName: p.plant.name,
        varieties: [],
        category: p.plant.category,
        beds: [],
        totalHarvest: 0,
        totalsByUnit: {},
        estYieldLbs: 0,
        logCount: 0,
        rating: p.rating,
        growAgain: p.growAgain,
        status: p.status,
      };
    }
    const bed = p.cell.bed.name;
    if (!byPlant[pid].beds.includes(bed)) byPlant[pid].beds.push(bed);
    if (p.variety && !byPlant[pid].varieties.includes(p.variety)) byPlant[pid].varieties.push(p.variety);
    const est = estimateYieldLbs(p.plant.category as PlantCategory, p._count.cells || 1, p.cell.bed.cellSizeIn);
    if (est != null) byPlant[pid].estYieldLbs += est;
    for (const log of p.harvestLogs) {
      byPlant[pid].totalHarvest += log.quantity;
      byPlant[pid].totalsByUnit[log.unit] = (byPlant[pid].totalsByUnit[log.unit] ?? 0) + log.quantity;
      byPlant[pid].logCount++;
    }
  }

  const summaries = Object.values(byPlant).sort((a, b) => b.totalHarvest - a.totalHarvest);
  const growAgainList = summaries.filter((s) => s.growAgain);
  const totalPlantings = season.plantings.length;
  const ratedCount = season.plantings.filter((p) => p.rating !== null).length;
  const avgRating = ratedCount > 0
    ? season.plantings.reduce((s, p) => s + (p.rating ?? 0), 0) / ratedCount
    : null;

  // ── Retrospective aggregates ──────────────────────────────────────────────
  const allLogs = season.plantings.flatMap((p) => p.harvestLogs);
  const totalLogCount = allLogs.length;

  // Units aren't comparable to each other, so the hero/bars/comparison all
  // speak in one unit: the season's dominant one (most log entries, then
  // most quantity).
  const unitTotals: Record<string, { qty: number; count: number }> = {};
  for (const log of allLogs) {
    unitTotals[log.unit] ??= { qty: 0, count: 0 };
    unitTotals[log.unit].qty += log.quantity;
    unitTotals[log.unit].count++;
  }
  const dominantUnit =
    Object.entries(unitTotals).sort(
      (a, b) => b[1].count - a[1].count || b[1].qty - a[1].qty
    )[0]?.[0] ?? null;

  // Top crop: the single biggest plant+unit harvest total of the season.
  let topCrop: { plantName: string; qty: number; unit: string } | null = null;
  for (const s of summaries) {
    for (const [unit, qty] of Object.entries(s.totalsByUnit)) {
      if (!topCrop || qty > topCrop.qty) topCrop = { plantName: s.plantName, qty, unit };
    }
  }

  // Harvest-by-month buckets in the dominant unit, bounded to the season's
  // date range (open seasons run to today) and capped at 12 months.
  type MonthBar = { key: string; label: string; qty: number };
  let monthBars: MonthBar[] = [];
  if (dominantUnit) {
    const rangeEnd = season.endDate ?? new Date();
    const months = new Map<string, MonthBar>();
    const cursor = new Date(season.startDate.getFullYear(), season.startDate.getMonth(), 1);
    while (cursor <= rangeEnd && months.size < 12) {
      months.set(`${cursor.getFullYear()}-${cursor.getMonth()}`, {
        key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
        label: cursor.toLocaleDateString("en-US", { month: "short" }),
        qty: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    for (const log of allLogs) {
      if (log.unit !== dominantUnit) continue;
      const bar = months.get(`${log.harvestedAt.getFullYear()}-${log.harvestedAt.getMonth()}`);
      if (bar) bar.qty += log.quantity;
    }
    monthBars = [...months.values()];
  }
  const maxMonthQty = Math.max(0, ...monthBars.map((b) => b.qty));
  const showBars = monthBars.length > 0 && maxMonthQty > 0;

  // Prior-season comparison, in the dominant unit.
  let comparison: string | null = null;
  if (dominantUnit) {
    if (prevSeason && prevTotals.length > 0) {
      const prevQty = prevTotals.find((t) => t.unit === dominantUnit)?._sum.quantity ?? 0;
      const diff = unitTotals[dominantUnit].qty - prevQty;
      comparison =
        Math.abs(diff) < 0.05
          ? "Level with last season."
          : diff > 0
          ? `Up ${fmtQty(diff)} ${dominantUnit} on last season.`
          : `Down ${fmtQty(-diff)} ${dominantUnit} on last season.`;
    } else {
      comparison = "First tracked season — next year gets a comparison.";
    }
  }

  const photoStamp = new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit" });

  return (
    <div>
      <div className="px-[22px] md:px-8 pt-5 pb-4" style={{ background: "#FDFDF8", borderBottom: "1px solid #E4E4DC" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <Link
            href={`/garden/${gardenId}/seasons`}
            aria-label="Back to seasons"
            style={{ width: "22px", height: "22px", borderRadius: "6px", background: "#F4F4EC", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#6B6B5A", flexShrink: 0, textDecoration: "none" }}
          ><ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden="true" /></Link>
          <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 500, color: "#6B6B5A" }}>
            {season.garden.name} · Seasons
          </span>
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 800, color: "#111109", letterSpacing: "-0.025em", lineHeight: 1, fontVariationSettings: "'opsz' 26" }}>
          {season.name}
        </h1>
      </div>
      <div className={`px-[22px] md:px-8 py-6 animate-fade-rise ${styles.retro}`}>

      {/* Hero — the season's headline */}
      <header className={styles.hero}>
        <span className={styles.eyebrow}>Season retrospective</span>
        <p className={styles.heroDates}>
          {season.startDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          {season.endDate && ` — ${season.endDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
        </p>
        <h2 className={styles.heroLine}>
          {topCrop ? (
            <>
              <em>{topCrop.plantName}</em> led the season — {fmtQty(topCrop.qty)} {topCrop.unit}.
            </>
          ) : totalPlantings > 0 ? (
            <>
              {totalPlantings} planting{totalPlantings === 1 ? "" : "s"}, <em>pressed and kept</em>.
            </>
          ) : (
            <>
              An empty page, <em>waiting</em>.
            </>
          )}
        </h2>
        {comparison && <p className={styles.heroCompare}>{comparison}</p>}

        {totalPlantings > 0 && (
          <div className={styles.statStrip}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Plantings</div>
              <div className={styles.statValue}>{totalPlantings}</div>
            </div>
            {dominantUnit && (
              <div className={styles.stat}>
                <div className={styles.statLabel}>Harvested</div>
                <div className={`${styles.statValue} ${styles.statValueAmber}`}>
                  {fmtQty(unitTotals[dominantUnit].qty)}
                </div>
                <div className={styles.statSub}>
                  {dominantUnit} · {totalLogCount} {totalLogCount === 1 ? "entry" : "entries"}
                </div>
              </div>
            )}
            {avgRating && (
              <div className={styles.stat}>
                <div className={styles.statLabel}>Avg rating</div>
                <div className={styles.statValue}>
                  {avgRating.toFixed(1)}<em> / 5</em>
                </div>
              </div>
            )}
            {growAgainList.length > 0 && (
              <div className={styles.stat}>
                <div className={styles.statLabel}>Grow again</div>
                <div className={styles.statValue}><em>{growAgainList.length}</em></div>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Photo strip — the season in polaroids */}
      {photos.length > 0 && (
        <section className={styles.photoSection}>
          <div className={styles.photoInner}>
            <div className={styles.sectionHead}>
              <div>
                <span className={styles.eyebrow}>From the journal</span>
                <div className={styles.sectionTitle}>
                  The season, <em>in pictures</em>.
                </div>
              </div>
              <span className={styles.sectionMeta}>
                {photos.length} photo{photos.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className={styles.polaroidGrid}>
              {photos.map((ph) => (
                <figure key={ph.id} className={styles.polaroid}>
                  <PolaroidImage
                    imageUrl={ph.url}
                    name={ph.planting.plant.name}
                    gradientClass={categoryGradient(ph.planting.plant.category)}
                    emoji={categoryEmoji(ph.planting.plant.category)}
                    imgWrapClass={styles.polaroidImg}
                    fallbackClass={styles.polaroidFallback}
                  />
                  <figcaption>
                    <span className={styles.polaroidStamp}>
                      {photoStamp.format(ph.takenAt)}
                    </span>
                    <span className={styles.polaroidName}>
                      {ph.planting.plant.name}
                      {ph.planting.variety && ` · ${ph.planting.variety}`}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Harvest by month */}
      {showBars && dominantUnit && (
        <section className={styles.barsSection}>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.eyebrow}>Harvest rhythm</span>
              <div className={styles.sectionTitle}>
                Month by <em>month</em>.
              </div>
            </div>
            <span className={styles.sectionMeta}>{dominantUnit} logged</span>
          </div>
          <div className={styles.bars}>
            {monthBars.map((b) => (
              <div key={b.key} className={styles.barCol}>
                <div className={styles.barValue}>{b.qty > 0 ? fmtQty(b.qty) : "·"}</div>
                <div className={styles.barTrack}>
                  <div
                    className={b.qty > 0 ? styles.barFill : `${styles.barFill} ${styles.barFillZero}`}
                    style={{ height: b.qty > 0 ? `${Math.max(5, (b.qty / maxMonthQty) * 100)}%` : 0 }}
                  />
                </div>
                <div className={styles.barLabel}>{b.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Harvest by plant */}
      {summaries.some((s) => s.logCount > 0) && (
        <section className={styles.listSection}>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.eyebrow}>The ledger</span>
              <div className={styles.sectionTitle}>
                What the beds <em>gave</em>.
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {summaries
              .filter((s) => s.logCount > 0)
              .map((s) => (
                <div key={s.plantId} className="flex items-center justify-between p-3 bg-[#FFF3E8] border border-orange-100 rounded-xl">
                  <div>
                    <Link href={`/plants/${s.plantId}`} className="text-sm font-medium text-[#111109] hover:text-[#1C3D0A]">
                      {s.plantName}
                    </Link>
                    {s.varieties.length > 0 && (
                      <span className="text-xs text-[#6B6B5A]"> · {s.varieties.join(", ")}</span>
                    )}
                    <p className="text-xs text-[#ADADAA]">{s.beds.join(", ")}</p>
                  </div>
                  <span className="text-sm font-semibold text-[#D4820A] text-right">
                    {Object.entries(s.totalsByUnit)
                      .map(([u, q]) => `${Number(q.toFixed(2))} ${u}`)
                      .join(" · ")}
                    {s.estYieldLbs > 0 && (
                      <span className="block text-xs font-normal text-[#ADADAA]">
                        ~{Number(s.estYieldLbs.toFixed(1))} lb est.
                      </span>
                    )}
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* All plantings */}
      {totalPlantings > 0 && (
        <section className={styles.listSection}>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.eyebrow}>Every planting</span>
              <div className={styles.sectionTitle}>
                The full <em>roster</em>.
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {summaries.map((s) => (
              <div key={s.plantId} className="flex items-center justify-between p-3 bg-white border border-[#E4E4DC] rounded-xl">
                <div>
                  <Link href={`/plants/${s.plantId}`} className="text-sm font-medium text-[#111109] hover:text-[#1C3D0A]">
                    {s.plantName}
                  </Link>
                  {s.varieties.length > 0 && (
                    <span className="text-xs text-[#6B6B5A]"> · {s.varieties.join(", ")}</span>
                  )}
                  <p className="text-xs text-[#ADADAA]">
                    {s.status.replace(/_/g, " ").toLowerCase()} · {s.beds.join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {s.rating && (
                    <span className="text-xs text-[#D4820A]">
                      {"★".repeat(s.rating)}
                    </span>
                  )}
                  {s.growAgain && (
                    <span className="text-[10px] bg-[#F4F4EC] text-[#3A6B20] font-medium px-2 py-0.5 rounded-full">
                      Grow again
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Grow again list */}
      {growAgainList.length > 0 && (
        <section>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.eyebrow}>Next year&apos;s list</span>
              <div className={styles.sectionTitle}>
                Plant <em>again</em>.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {growAgainList.map((s) => (
              <Link
                key={s.plantId}
                href={`/plants/${s.plantId}`}
                className="text-sm bg-[#F4F4EC] border border-[#E4E4DC] text-[#1C3D0A] px-3 py-1.5 rounded-full hover:bg-[#E4E4DC] transition-colors font-medium"
              >
                {s.plantName}
              </Link>
            ))}
          </div>
        </section>
      )}

      {totalPlantings === 0 && (
        <div className="text-center py-12 text-[#ADADAA]">
          <p className="text-sm">No plantings recorded for this season.</p>
        </div>
      )}
      </div>
    </div>
  );
}
