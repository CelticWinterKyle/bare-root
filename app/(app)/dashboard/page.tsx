import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenAccessFilter } from "@/lib/permissions";
import { fetchCurrentWeather, fetchForecast, hasFrostRisk } from "@/lib/api/weather";
import type { CurrentWeather, ForecastDay } from "@/lib/api/weather";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Sprout } from "lucide-react";
import styles from "./dashboard.module.css";

export const dynamic = "force-dynamic";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeOfDay(d: Date): "morning" | "afternoon" | "evening" {
  const h = d.getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function fmtDay(d: Date): string {
  // "Friday · May 15, 2026"
  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).formatToParts(d);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  return `${weekday} · ${month} ${day}, ${year}`;
}

function fmtHeroDate(d: Date): string {
  // "Friday morning · the 15th of May"
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(d);
  const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(d);
  return `${weekday} ${timeOfDay(d)} · the ${ordinal(d.getDate())} of ${month}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

const REMINDER_LABEL: Record<string, string> = {
  START_SEEDS: "Start indoors",
  TRANSPLANT: "Transplant",
  WATER: "Water",
  HARVEST: "Harvest",
  FROST_ALERT: "Frost watch",
  FERTILIZE: "Fertilize",
  SUCCESSION_PLANTING: "Succession",
  CROP_ROTATION: "Rotate",
  CUSTOM: "Note",
};

const REMINDER_ICON: Record<string, string> = {
  START_SEEDS: "✿",
  TRANSPLANT: "↑",
  WATER: "◐",
  HARVEST: "⊕",
  FROST_ALERT: "❅",
  FERTILIZE: "✿",
  SUCCESSION_PLANTING: "✿",
  CROP_ROTATION: "↻",
  CUSTOM: "•",
};

function reminderIconClass(type: string): string {
  switch (type) {
    case "START_SEEDS":
    case "SUCCESSION_PLANTING":
    case "FERTILIZE":
      return styles.taskIconSeed;
    case "TRANSPLANT":
    case "CROP_ROTATION":
      return styles.taskIconTrans;
    case "WATER":
      return styles.taskIconWater;
    case "HARVEST":
      return styles.taskIconHarvest;
    case "FROST_ALERT":
      return styles.taskIconFrost;
    default:
      return styles.taskIconCustom;
  }
}

function upcomingTypeClass(type: string): string {
  switch (type) {
    case "START_SEEDS":
    case "SUCCESSION_PLANTING":
    case "FERTILIZE":
      return styles.upcomingTypeSeed;
    case "TRANSPLANT":
    case "CROP_ROTATION":
      return styles.upcomingTypeTrans;
    case "HARVEST":
      return styles.upcomingTypeHarvest;
    case "WATER":
      return styles.upcomingTypeWater;
    case "FROST_ALERT":
      return styles.upcomingTypeFrost;
    default:
      return styles.upcomingTypeOther;
  }
}

function categoryGradient(cat: string | undefined): string {
  switch (cat) {
    case "VEGETABLE":
      return styles.polaroidImgVeg;
    case "HERB":
      return styles.polaroidImgHerb;
    case "FRUIT":
      return styles.polaroidImgFruit;
    case "FLOWER":
      return styles.polaroidImgFlower;
    default:
      return styles.polaroidImgOther;
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

function microCellClass(
  cell: { occupiedBy: { isPrimary: boolean; planting: { status: string } }[] }
): string {
  if (cell.occupiedBy.length === 0) return styles.mcEmpty;
  const entry = cell.occupiedBy[0];
  const status = entry.planting.status;
  if (status === "SEEDS_STARTED") return styles.mcSeed;
  if (status === "HARVESTING") return styles.mcAmber;
  if (!entry.isPrimary) return styles.mcMulti;
  return styles.mcActive;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const user = await requireUser();
  if (!user.onboardingComplete) redirect("/onboarding");

  const firstName = user.name?.split(" ")[0];
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const gardens = await db.garden.findMany({
    where: gardenAccessFilter(user.id),
    include: {
      _count: { select: { beds: true } },
      seasons: { where: { isActive: true }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });

  // ── No gardens → empty state ───────────────────────────────────────────────
  if (gardens.length === 0) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.topbar}>
          <div className={styles.topbarMeta}>
            <span className={styles.topbarDate}>{fmtDay(now)}</span>
          </div>
        </div>
        <div className={styles.emptyState}>
          <div className={styles.emptyCard}>
            <div className={styles.emptyHead}>
              <Sprout className="w-9 h-9" style={{ color: "rgba(168,216,112,0.7)" }} />
              <h1 className={styles.emptyHeadTitle}>
                Set up your <em>first</em> garden
              </h1>
              <p className={styles.emptyHeadSub}>
                Add your beds, map your space, and start planning.
              </p>
            </div>
            <div className={styles.emptyBody}>
              <Link href="/onboarding" className={styles.emptyCta}>
                Start setup
                <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic" }}>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Primary garden — load detail + weather ─────────────────────────────────
  const primaryGarden = await db.garden.findFirst({
    where: { id: gardens[0].id },
    include: {
      beds: {
        include: {
          cells: {
            orderBy: [{ row: "asc" }, { col: "asc" }],
            include: {
              occupiedBy: {
                where: { planting: { season: { isActive: true } } },
                include: {
                  planting: { select: { status: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      seasons: { where: { isActive: true }, take: 1 },
      weatherCache: true,
    },
  });

  // Type-narrowing — primaryGarden is guaranteed by gardens.length check above.
  if (!primaryGarden) redirect("/onboarding");

  const activeSeason = primaryGarden.seasons[0] ?? null;

  // Weather (refresh if cache older than 3 hours)
  let weatherCurrent: CurrentWeather | null = null;
  let weatherForecast: ForecastDay[] | null = null;
  if (primaryGarden.locationZip) {
    const THREE_HOURS = 3 * 60 * 60 * 1000;
    const cacheAge = primaryGarden.weatherCache
      ? Date.now() - new Date(primaryGarden.weatherCache.updatedAt).getTime()
      : Infinity;

    if (cacheAge > THREE_HOURS) {
      const [c, f] = await Promise.all([
        fetchCurrentWeather(primaryGarden.locationZip),
        fetchForecast(primaryGarden.locationZip),
      ]);
      weatherCurrent = c;
      weatherForecast = f;
      if (c || f) {
        await db.weatherCache.upsert({
          where: { gardenId: primaryGarden.id },
          create: { gardenId: primaryGarden.id, current: c ?? {}, forecast: f ?? [] },
          update: { current: c ?? {}, forecast: f ?? [] },
        });
      }
    } else {
      weatherCurrent = primaryGarden.weatherCache?.current as CurrentWeather | null;
      const raw = primaryGarden.weatherCache?.forecast;
      weatherForecast = Array.isArray(raw) ? (raw as ForecastDay[]) : null;
    }
  }
  const frostRisk = weatherForecast ? hasFrostRisk(weatherForecast) : false;
  const frostDay = frostRisk
    ? weatherForecast?.find((d) => d.minTemp <= 35) ?? null
    : null;
  const nextLow = weatherForecast?.reduce<number | null>(
    (min, d) => (min === null || d.minTemp < min ? d.minTemp : min),
    null
  ) ?? null;
  const nextHigh = weatherForecast?.reduce<number | null>(
    (max, d) => (max === null || d.maxTemp > max ? d.maxTemp : max),
    null
  ) ?? null;

  // ── Reminders ──────────────────────────────────────────────────────────────
  const [todayReminders, upcomingReminders, alertReminders] = await Promise.all([
    db.reminder.findMany({
      where: {
        userId: user.id,
        dismissed: false,
        scheduledAt: { lte: tomorrow },
      },
      orderBy: { scheduledAt: "asc" },
      take: 4,
      include: {
        planting: { include: { plant: { select: { name: true } }, cell: { include: { bed: { select: { name: true, gardenId: true } } } } } },
        garden: { select: { name: true } },
      },
    }),
    db.reminder.findMany({
      where: {
        userId: user.id,
        dismissed: false,
        scheduledAt: { gt: tomorrow, lte: in30Days },
      },
      orderBy: { scheduledAt: "asc" },
      take: 3,
      include: {
        planting: { include: { plant: { select: { name: true } }, cell: { include: { bed: { select: { name: true, gardenId: true } } } } } },
        garden: { select: { name: true } },
      },
    }),
    db.reminder.findMany({
      where: {
        userId: user.id,
        dismissed: false,
        sentAt: { not: null },
      },
      orderBy: { sentAt: "desc" },
      take: 2,
      include: {
        planting: { include: { plant: { select: { name: true } } } },
      },
    }),
  ]);

  const totalActiveReminders = await db.reminder.count({
    where: { userId: user.id, dismissed: false },
  });
  const remindersThisWeek = await db.reminder.count({
    where: {
      userId: user.id,
      dismissed: false,
      scheduledAt: { lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) },
    },
  });

  // ── Aggregate stats across user's gardens ─────────────────────────────────
  const accessibleGardenIds = gardens.map((g) => g.id);

  const yearStart = new Date(today.getFullYear(), 0, 1);
  const harvestThisYear = await db.harvestLog.aggregate({
    _sum: { quantity: true },
    where: {
      planting: {
        cell: { bed: { gardenId: { in: accessibleGardenIds } } },
      },
      harvestedAt: { gte: yearStart },
    },
  });
  const yieldLbs = (harvestThisYear._sum.quantity ?? 0) as number;

  const recentHarvests = await db.harvestLog.findMany({
    where: {
      planting: {
        cell: { bed: { gardenId: { in: accessibleGardenIds } } },
      },
    },
    orderBy: { harvestedAt: "desc" },
    take: 4,
    include: {
      planting: {
        include: {
          plant: { select: { name: true, category: true, imageUrl: true } },
          cell: { include: { bed: { select: { name: true } } } },
        },
      },
    },
  });

  const activePlantingCount = activeSeason
    ? await db.planting.count({ where: { seasonId: activeSeason.id } })
    : 0;

  // Next harvest = earliest expectedHarvestDate in future for accessible gardens
  const nextHarvestPlanting = await db.planting.findFirst({
    where: {
      expectedHarvestDate: { gte: now },
      actualHarvestDate: null,
      cell: { bed: { gardenId: { in: accessibleGardenIds } } },
    },
    orderBy: { expectedHarvestDate: "asc" },
    include: { plant: { select: { name: true } } },
  });
  const daysToNextHarvest = nextHarvestPlanting?.expectedHarvestDate
    ? Math.max(0, daysBetween(today, startOfDay(nextHarvestPlanting.expectedHarvestDate)))
    : null;

  // Average rating
  const ratings = await db.planting.findMany({
    where: {
      rating: { not: null },
      cell: { bed: { gardenId: { in: accessibleGardenIds } } },
    },
    select: { rating: true },
  });
  const avgRating = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + (r.rating ?? 0), 0) / ratings.length
    : null;

  // ── Season progress ────────────────────────────────────────────────────────
  let seasonDayN: number | null = null;
  let seasonTotalDays: number | null = null;
  let seasonPct = 0;
  let seasonDates: string | null = null;
  if (activeSeason) {
    const start = startOfDay(activeSeason.startDate);
    const end = activeSeason.endDate ? startOfDay(activeSeason.endDate) : null;
    seasonDayN = Math.max(1, daysBetween(start, today) + 1);
    if (end) {
      seasonTotalDays = Math.max(1, daysBetween(start, end) + 1);
      seasonPct = Math.min(100, Math.max(0, (seasonDayN / seasonTotalDays) * 100));
      const fmtShort = (d: Date) =>
        new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
      seasonDates = `${fmtShort(start)} → ${fmtShort(end)}`;
    } else {
      seasonDates = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(start);
    }
  }

  // ── Hero subtitle copy (data-driven) ───────────────────────────────────────
  let heroSub = "A quiet day in the garden. Worth checking the beds.";
  if (frostRisk && frostDay) {
    const lowF = Math.round(frostDay.minTemp);
    heroSub = `Cold night ahead — ${lowF}°F forecast. Cover tender plants before dusk and check again in the morning.`;
  } else if (todayReminders.length >= 2) {
    heroSub = `${todayReminders.length} tasks waiting today. The garden's settled, but a few things need your hands.`;
  } else if (recentHarvests.length > 0) {
    const daysSince = daysBetween(startOfDay(recentHarvests[0].harvestedAt), today);
    if (daysSince <= 3) {
      const what = recentHarvests[0].planting.plant.name.toLowerCase();
      heroSub = `Last harvest was ${daysSince === 0 ? "today" : `${daysSince} day${daysSince === 1 ? "" : "s"} ago`} — fresh ${what}. The yields are coming in.`;
    }
  } else if (activePlantingCount > 0) {
    heroSub = `${activePlantingCount} planting${activePlantingCount === 1 ? "" : "s"} growing across the season. A good time to walk the beds.`;
  }

  // ── Bed tile mini-grid (first 8 cells) ─────────────────────────────────────
  const bedTilesData = primaryGarden.beds.slice(0, 3).map((bed) => {
    const microCells = bed.cells.slice(0, 8);
    while (microCells.length < 8) {
      microCells.push({
        id: `placeholder-${bed.id}-${microCells.length}`,
        bedId: bed.id,
        row: 0,
        col: 0,
        sunLevel: "FULL_SUN" as const,
        notes: null,
        occupiedBy: [],
      });
    }
    const plantCount = new Set(
      bed.cells.flatMap((c) => c.occupiedBy.map((o) => o.plantingId))
    ).size;
    return {
      id: bed.id,
      name: bed.name,
      sizeFt: `${bed.widthFt} × ${bed.heightFt} ft`,
      plantCount,
      cells: microCells,
    };
  });

  // ── Garden card mini-SVG (top-down bed layout) ─────────────────────────────
  const gardenW = primaryGarden.widthFt;
  const gardenH = primaryGarden.heightFt;
  const svgW = 800;
  const svgH = 450;
  const padding = 40;
  const scaleX = (svgW - padding * 2) / gardenW;
  const scaleY = (svgH - padding * 2) / gardenH;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (svgW - gardenW * scale) / 2;
  const offsetY = (svgH - gardenH * scale) / 2;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.dashboard}>
      {/* Top bar */}
      <div className={styles.topbar}>
        <div className={styles.topbarMeta}>
          <span className={styles.topbarDate}>{fmtDay(now)}</span>
          {activeSeason && seasonDayN !== null && (
            <span className={styles.topbarEdition}>
              The garden — <em>Day {seasonDayN}</em> of {activeSeason.name}
            </span>
          )}
        </div>
      </div>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <span className={styles.eyebrow}>Today&apos;s edition</span>
          <div className={styles.heroDate}>{fmtHeroDate(now)}</div>
          <h1 className={styles.heroGreeting}>
            Good {timeOfDay(now)},<br />
            <em>{firstName ?? "gardener"}.</em>
          </h1>
          <p className={styles.heroSub}>{heroSub}</p>
        </div>

        <div className={styles.weather}>
          {weatherCurrent ? (
            <>
              <div className={styles.weatherTop}>
                <div className={styles.weatherTemp}>
                  {weatherCurrent.temp}
                  <sup>°</sup>
                </div>
                <div>
                  <div className={styles.weatherZone}>
                    {primaryGarden.usdaZone ? `Zone ${primaryGarden.usdaZone}` : "Zone —"}
                    {primaryGarden.locationZip ? ` · ${primaryGarden.locationZip}` : ""}
                  </div>
                  <div className={styles.weatherDesc}>{weatherCurrent.description}</div>
                </div>
              </div>
              <div className={styles.weatherDivider} />
              <div className={styles.weatherStats}>
                <div className={styles.weatherStat}>
                  <div className="label">Low</div>
                  <div className="value">
                    {nextLow !== null ? nextLow : "—"}
                    <sup style={{ fontSize: 11 }}>°</sup>
                  </div>
                </div>
                <div className={styles.weatherStat}>
                  <div className="label">High</div>
                  <div className="value">
                    {nextHigh !== null ? nextHigh : "—"}
                    <sup style={{ fontSize: 11 }}>°</sup>
                  </div>
                </div>
                <div className={styles.weatherStat}>
                  <div className="label">Last frost</div>
                  <div className="value">
                    <em>{primaryGarden.lastFrostDate ?? "—"}</em>
                  </div>
                </div>
              </div>
              {frostRisk && frostDay && (
                <div className={styles.weatherAlert}>
                  ⚠ Cold night · {Math.round(frostDay.minTemp)}°F on {frostDay.date.slice(5)}
                </div>
              )}
            </>
          ) : (
            <>
              <div className={styles.weatherTop}>
                <div className={styles.weatherTemp}>
                  —<sup>°</sup>
                </div>
                <div>
                  <div className={styles.weatherZone}>
                    {primaryGarden.usdaZone ? `Zone ${primaryGarden.usdaZone}` : "No zone set"}
                  </div>
                  <div className={styles.weatherDesc}>
                    {primaryGarden.locationZip ? "Weather refreshing" : "Weather unavailable"}
                  </div>
                </div>
              </div>
              <div className={styles.weatherEmpty}>
                {primaryGarden.locationZip ? (
                  <>We&apos;ll pull the forecast for {primaryGarden.locationZip} on your next visit.</>
                ) : (
                  <>
                    <Link
                      href={`/garden/${primaryGarden.id}/settings`}
                      style={{ color: "#A8D870", textDecoration: "underline" }}
                    >
                      Add a ZIP code
                    </Link>{" "}
                    in garden settings to see your local forecast here.
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Today's tasks */}
      <section className={styles.todaySection}>
        <div className={styles.sectionHead}>
          <div>
            <span className={`${styles.eyebrow} ${styles.muted}`}>§ 01 · The list</span>
            <div className={styles.sectionTitle}>
              {todayReminders.length > 0
                ? `${todayReminders.length === 1 ? "One thing" : `${todayReminders.length} things`} for `
                : "Nothing pressing "}
              <em>today</em>
              {todayReminders.length > 0 ? "." : "."}
            </div>
          </div>
          <Link href="/reminders" className={styles.sectionAction}>
            All reminders →
          </Link>
        </div>

        <div className={styles.taskRow}>
          {todayReminders.length > 0 ? (
            todayReminders.map((r) => {
              const plantName = r.planting?.plant.name ?? r.title;
              const bedName = r.planting?.cell.bed.name;
              const due = r.scheduledAt;
              const overdue = due < today;
              const isToday = due >= today && due < tomorrow;
              const whenLabel = overdue
                ? `↗ Overdue · ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(due)}`
                : isToday
                ? "● Today"
                : `○ ${new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(due)}`;
              const whenClass = overdue
                ? styles.taskWhenDue
                : isToday
                ? styles.taskWhenNow
                : "";
              const href = r.planting?.cell.bed.gardenId
                ? `/garden/${r.planting.cell.bed.gardenId}`
                : "/reminders";
              return (
                <Link key={r.id} href={href} className={styles.taskCard}>
                  <div className={styles.taskCardHead}>
                    <div className={`${styles.taskIcon} ${reminderIconClass(r.type)}`}>
                      {REMINDER_ICON[r.type] ?? "•"}
                    </div>
                    <div className={styles.taskType}>{REMINDER_LABEL[r.type] ?? "Task"}</div>
                  </div>
                  <div className={styles.taskPlant}>
                    <em>{plantName}</em>
                  </div>
                  <div className={styles.taskDetail}>
                    {r.body ?? (bedName ? `Bed ${bedName}` : r.title)}
                  </div>
                  <div className={`${styles.taskWhen} ${whenClass}`}>{whenLabel}</div>
                </Link>
              );
            })
          ) : (
            <div className={styles.taskEmpty}>
              <div className={styles.taskEmptyTitle}>The garden&apos;s coasting.</div>
              <div className={styles.taskEmptySub}>
                No reminders for today. Worth checking the beds anyway.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Garden + side widgets */}
      <section className={styles.dashboardGrid}>
        <div>
          <div className={styles.sectionHeadBare}>
            <div>
              <span className={`${styles.eyebrow} ${styles.muted}`}>§ 02 · Your garden</span>
              <div className={styles.sectionTitle}>
                <em>{firstName ? `${firstName}'s` : "Your"}</em> {primaryGarden.name}
              </div>
            </div>
            <Link href={`/garden/${primaryGarden.id}`} className={styles.sectionAction}>
              Open canvas →
            </Link>
          </div>

          <div className={styles.gardenCard}>
            <div className={styles.gardenCardHeader}>
              <div className={styles.gardenCardRow}>
                <div>
                  <h2 className={styles.gardenCardName}>
                    {gardenW} × {gardenH} ft <em>plot</em>
                  </h2>
                  <div className={styles.gardenCardMeta}>
                    {primaryGarden.usdaZone && (
                      <span className={styles.tag}>Zone {primaryGarden.usdaZone}</span>
                    )}
                    {activeSeason && <span className={styles.tag}>{activeSeason.name}</span>}
                    <span className={styles.tag}>
                      {primaryGarden.beds.length} bed{primaryGarden.beds.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <Link href={`/garden/${primaryGarden.id}`} className={styles.gardenCardOpen}>
                  Open <span>→</span>
                </Link>
              </div>
            </div>

            <div className={styles.gardenCardCanvas}>
              <div className={styles.gardenCardCanvasPill}>
                Garden Canvas · {gardenW}×{gardenH} ft
              </div>
              <svg viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet">
                <defs>
                  <pattern id="dashGrass" x="0" y="0" width="18" height="9" patternUnits="userSpaceOnUse">
                    <rect width="18" height="9" fill="#4a7c3f" />
                    <ellipse cx="4" cy="4.5" rx="1.8" ry="1.1" fill="#3d6b32" opacity="0.4" />
                    <ellipse cx="13" cy="2" rx="1.2" ry="0.8" fill="#56904a" opacity="0.35" />
                  </pattern>
                  <pattern id="dashSoil" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
                    <rect width="12" height="12" fill="#3d2b1f" />
                    <circle cx="3" cy="3" r="1.3" fill="#2d1f14" opacity="0.6" />
                    <circle cx="8.5" cy="7" r="1.1" fill="#2d1f14" opacity="0.5" />
                  </pattern>
                  <filter id="dashDs">
                    <feDropShadow dx="2" dy="4" stdDeviation="2.5" floodColor="#000" floodOpacity="0.35" />
                  </filter>
                </defs>
                <rect
                  x={offsetX}
                  y={offsetY}
                  width={gardenW * scale}
                  height={gardenH * scale}
                  fill="url(#dashGrass)"
                  rx={8}
                />
                {primaryGarden.beds.map((bed) => {
                  const bx = offsetX + bed.xPosition * scale;
                  const by = offsetY + bed.yPosition * scale;
                  const bw = bed.widthFt * scale;
                  const bh = bed.heightFt * scale;
                  const plantCount = new Set(
                    bed.cells.flatMap((c) => c.occupiedBy.map((o) => o.plantingId))
                  ).size;
                  return (
                    <g key={bed.id} filter="url(#dashDs)">
                      <rect x={bx} y={by} width={bw} height={bh} fill="#7D5630" rx={3} />
                      <rect
                        x={bx + 3}
                        y={by + 3}
                        width={Math.max(0, bw - 6)}
                        height={Math.max(0, bh - 6)}
                        fill="url(#dashSoil)"
                        rx={2}
                      />
                      {plantCount > 0 && (
                        <text
                          x={bx + bw / 2}
                          y={by + bh / 2 + 4}
                          textAnchor="middle"
                          fill="#f0e0c0"
                          fontSize="12"
                          fontWeight="700"
                          fontFamily="Fraunces, Georgia, serif"
                          fontStyle="italic"
                        >
                          {bed.name}
                        </text>
                      )}
                    </g>
                  );
                })}
                <g opacity="0.3" transform={`translate(${offsetX + 22}, ${offsetY + gardenH * scale - 22})`}>
                  <circle cx="0" cy="0" r="12" fill="none" stroke="#A8D870" strokeWidth="1" />
                  <text x="0" y="-15" textAnchor="middle" fill="#A8D870" fontSize="7" fontFamily="IBM Plex Mono">
                    N
                  </text>
                  <line x1="0" y1="-10" x2="0" y2="-3" stroke="#A8D870" strokeWidth="1.5" />
                </g>
              </svg>
            </div>

            <div className={styles.gardenCardStats}>
              <div className={styles.gardenStat}>
                <div className="label">Plantings</div>
                <div className="value">
                  <em>{activePlantingCount}</em>
                </div>
                <div className="valueSub">
                  across {primaryGarden.beds.length} bed{primaryGarden.beds.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className={styles.gardenStat}>
                <div className="label">This year</div>
                <div className="value">
                  {yieldLbs > 0 ? `${yieldLbs.toFixed(1)} lb` : "—"}
                </div>
                <div className="valueSub">{yieldLbs > 0 ? "harvested" : "yet to harvest"}</div>
              </div>
              <div className={styles.gardenStat}>
                <div className="label">Next harvest</div>
                <div className="value valueAmber">
                  {daysToNextHarvest !== null ? `~${daysToNextHarvest}d` : "—"}
                </div>
                <div className="valueSub">
                  {nextHarvestPlanting?.plant.name ?? "no plantings"}
                </div>
              </div>
              <div className={styles.gardenStat}>
                <div className="label">Reminders</div>
                <div className="value">{totalActiveReminders}</div>
                <div className="valueSub">
                  {remindersThisWeek > 0
                    ? `${remindersThisWeek} this week`
                    : "none this week"}
                </div>
              </div>
            </div>
          </div>

          {bedTilesData.length > 0 && (
            <div className={styles.bedsStrip}>
              {bedTilesData.map((bed, i) => {
                const accent = [styles.bedTileAccent1, styles.bedTileAccent2, styles.bedTileAccent3][i] ?? styles.bedTileAccent1;
                return (
                  <Link
                    key={bed.id}
                    href={`/garden/${primaryGarden.id}/beds/${bed.id}`}
                    className={styles.bedTile}
                  >
                    <div className={`${styles.bedTileAccent} ${accent}`} />
                    <div className={styles.bedTileBody}>
                      <div>
                        <div className={styles.bedTileName}>
                          Bed <em>{bed.name}</em>
                        </div>
                        <div className={styles.bedTileMeta}>{bed.sizeFt}</div>
                      </div>
                      <div className={styles.bedTileCount}>
                        <div className="num">{bed.plantCount}</div>
                        <div className="label">
                          {bed.plantCount === 1 ? "plant" : "plants"}
                        </div>
                      </div>
                    </div>
                    <div className={styles.bedTileGrid}>
                      {bed.cells.map((cell, idx) => (
                        <div
                          key={`${bed.id}-${idx}`}
                          className={`${styles.microCell} ${microCellClass(cell)}`}
                        />
                      ))}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Side widgets */}
        <aside className={styles.dashSide}>
          {activeSeason && (
            <div className={styles.widget}>
              <div className={styles.widgetHead}>
                <div className={styles.widgetTitle}>
                  The <em>season</em>
                </div>
                {seasonTotalDays && (
                  <span className={styles.widgetMeta}>
                    Day {seasonDayN} / {seasonTotalDays}
                  </span>
                )}
              </div>
              <div className={styles.seasonCard}>
                <div className={styles.seasonName}>{activeSeason.name}</div>
                <div className={styles.seasonDates}>{seasonDates}</div>
                <div className={styles.seasonBar}>
                  <div
                    className={styles.seasonBarFill}
                    style={{ width: `${seasonPct}%` }}
                  />
                  <div
                    className={styles.seasonBarMarker}
                    style={{ left: `${seasonPct}%` }}
                  />
                </div>
                <div className={styles.seasonProgress}>
                  <span>Start</span>
                  <span>
                    <strong>{Math.round(seasonPct)}%</strong> complete
                  </span>
                  <span>End</span>
                </div>
              </div>
            </div>
          )}

          <div className={styles.widget}>
            <div className={styles.widgetHead}>
              <div className={styles.widgetTitle}>
                At a <em>glance</em>
              </div>
              <span className={styles.widgetMeta}>Year to date</span>
            </div>
            <div className={styles.qstats}>
              <div className={styles.qstat}>
                <div className="num">
                  <em>{activePlantingCount}</em>
                </div>
                <div className="label">Active plantings</div>
              </div>
              <div className={styles.qstat}>
                <div className="num">{recentHarvests.length}</div>
                <div className="label">Recent harvests</div>
              </div>
              <div className={styles.qstat}>
                <div className="num">
                  {yieldLbs > 0 ? yieldLbs.toFixed(1) : "0"}
                  <span className="numSub">lb</span>
                </div>
                <div className="label">Harvested</div>
              </div>
              <div className={styles.qstat}>
                <div className="num">
                  {avgRating !== null ? avgRating.toFixed(1) : "—"}
                </div>
                <div className="label">Avg rating</div>
              </div>
            </div>
          </div>

          <div className={styles.widget}>
            <div className={styles.widgetHead}>
              <div className={styles.widgetTitle}>
                Coming <em>up</em>
              </div>
              <Link href="/calendar" className={styles.sectionAction} style={{ fontSize: 9 }}>
                View →
              </Link>
            </div>
            {upcomingReminders.length > 0 ? (
              <div className={styles.upcomingList}>
                {upcomingReminders.map((r) => {
                  const d = r.scheduledAt;
                  const dow = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);
                  const plantName = r.planting?.plant.name ?? r.title;
                  const where =
                    r.planting?.cell.bed.name
                      ? `Bed ${r.planting.cell.bed.name}`
                      : r.garden?.name ?? "";
                  const href = r.planting?.cell.bed.gardenId
                    ? `/garden/${r.planting.cell.bed.gardenId}`
                    : "/reminders";
                  return (
                    <Link key={r.id} href={href} className={styles.upcomingItem}>
                      <div className={styles.upcomingDay}>
                        <div className={styles.upcomingDayNum}>{d.getDate()}</div>
                        <div className={styles.upcomingDayDow}>{dow}</div>
                      </div>
                      <div className={styles.upcomingInfo}>
                        <span className={`${styles.upcomingType} ${upcomingTypeClass(r.type)}`}>
                          {REMINDER_LABEL[r.type] ?? "Task"}
                        </span>
                        <div className={styles.upcomingName}>
                          <em>{plantName}</em>
                        </div>
                        {where && <div className={styles.upcomingWhere}>{where}</div>}
                      </div>
                      <div className={styles.upcomingPip} />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className={styles.widgetEmpty}>Nothing in the next 30 days.</div>
            )}
          </div>

          {alertReminders.length > 0 && (
            <div className={styles.widget}>
              <div className={styles.widgetHead}>
                <div className={styles.widgetTitle}>
                  <em>Alerts</em>
                </div>
                <span className={styles.widgetMeta}>
                  {alertReminders.length} new
                </span>
              </div>
              <div>
                {alertReminders.map((r) => {
                  const sentAgo = r.sentAt ? sinceLabel(r.sentAt, now) : null;
                  const stripClass =
                    r.type === "WATER"
                      ? styles.reminderStripBlue
                      : r.type === "HARVEST"
                      ? styles.reminderStripGreen
                      : "";
                  const iconClass =
                    r.type === "WATER"
                      ? styles.reminderIconBlue
                      : r.type === "HARVEST"
                      ? styles.reminderIconGreen
                      : "";
                  return (
                    <div key={r.id} className={styles.reminderItem}>
                      <div className={`${styles.reminderStrip} ${stripClass}`} />
                      <div className={`${styles.reminderIcon} ${iconClass}`}>
                        {REMINDER_ICON[r.type] ?? "•"}
                      </div>
                      <div className={styles.reminderText}>
                        <div className={styles.reminderTitle}>{r.title}</div>
                        {r.body && <div className={styles.reminderSub}>{r.body}</div>}
                        {sentAgo && <div className={styles.reminderTime}>{sentAgo}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </aside>
      </section>

      {/* Journal */}
      <section className={styles.journal}>
        <div className={styles.journalInner}>
          <div className={styles.sectionHead}>
            <div>
              <span className={`${styles.eyebrow} ${styles.muted}`}>§ 03 · The journal</span>
              <div className={styles.sectionTitle}>
                Recent <em>entries</em>.
              </div>
            </div>
            <Link href="/calendar" className={styles.sectionAction}>
              Full history →
            </Link>
          </div>

          {recentHarvests.length > 0 ? (
            <div className={styles.journalGrid}>
              {recentHarvests.map((h) => {
                const plant = h.planting.plant;
                const stamp = new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "2-digit",
                  weekday: "short",
                }).format(h.harvestedAt).replace(",", " ·");
                const rating = h.planting && (h.planting as { rating?: number | null }).rating;
                return (
                  <Link
                    key={h.id}
                    href={`/garden/${gardens[0].id}`}
                    className={styles.polaroid}
                  >
                    <div className={`${styles.polaroidImg} ${categoryGradient(plant.category)}`}>
                      {plant.imageUrl ? (
                        <Image
                          src={plant.imageUrl}
                          alt={plant.name}
                          width={200}
                          height={200}
                        />
                      ) : (
                        <span className={styles.polaroidImgFallback}>
                          {categoryEmoji(plant.category)}
                        </span>
                      )}
                    </div>
                    <div className={styles.polaroidMeta}>
                      <span className={styles.polaroidStamp}>{stamp}</span>
                      {rating != null && rating > 0 && (
                        <span className={styles.polaroidRating}>
                          {"★".repeat(rating)}
                          {"☆".repeat(Math.max(0, 5 - rating))}
                        </span>
                      )}
                    </div>
                    <div className={styles.polaroidName}>{plant.name}</div>
                    <div className={styles.polaroidYield}>
                      {h.quantity} {h.unit}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className={styles.journalEmpty}>
              <div className={styles.journalEmptyTitle}>
                The journal&apos;s waiting for its first entry.
              </div>
              <div className={styles.journalEmptySub}>
                Log a harvest from any planting and it&apos;ll show up here.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Suggestion */}
      <section className={styles.suggest}>
        <div className={styles.sectionHead}>
          <div>
            <span className={`${styles.eyebrow} ${styles.muted}`}>§ 04 · Worth doing</span>
            <div className={styles.sectionTitle}>
              A suggestion from the <em>field</em>.
            </div>
          </div>
        </div>
        <div className={styles.suggestCard}>
          <div>
            <div className={styles.suggestEyebrow}>Succession planting</div>
            <div className={styles.suggestTitle}>
              Browse the <em>plant library</em> for what to sow next.
            </div>
            <p className={styles.suggestBody}>
              The garden does best when something&apos;s always coming up. Look through your
              library and start a second sowing of greens, beans, or anything that
              matures quickly — your harvests will stay continuous.
            </p>
            <Link href="/plants" className={styles.suggestCta}>
              Open plant library
              <span className={styles.suggestCtaArrow}>→</span>
            </Link>
          </div>
          <div className={styles.suggestViz}>
            <div className={styles.suggestVizNum}>
              {activePlantingCount}
              <span>plants</span>
            </div>
            <div className={styles.suggestVizLabel}>growing this season</div>
          </div>
        </div>
      </section>
    </div>
  );
}

function sinceLabel(when: Date, now: Date): string {
  const ms = now.getTime() - when.getTime();
  const min = Math.floor(ms / (60 * 1000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}
