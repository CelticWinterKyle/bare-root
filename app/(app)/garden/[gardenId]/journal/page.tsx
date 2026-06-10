import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenAccessFilter } from "@/lib/permissions";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, StickyNote, Scissors, Camera } from "lucide-react";

// Per-type query bound. Each source is capped, then the merged timeline is
// capped again at MERGED_CAP — keeps the page bounded no matter how busy a
// season got.
const PER_TYPE_TAKE = 50;
const MERGED_CAP = 100;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gardenId: string }>;
}): Promise<Metadata> {
  const { gardenId } = await params;
  const garden = await db.garden.findUnique({ where: { id: gardenId }, select: { name: true } });
  return { title: garden ? `Journal · ${garden.name} | Bare Root` : "Bare Root" };
}

type Entry = {
  key: string;
  kind: "note" | "harvest" | "photo";
  at: Date;
  /** Planting context — null for garden-level notes. */
  planting: {
    plantName: string;
    variety: string | null;
    bedName: string;
    href: string;
  } | null;
  body: string | null;
  /** Harvest only. */
  yieldLabel: string | null;
  /** Photo only. */
  photoUrl: string | null;
};

const inGarden = (gardenId: string) => ({ cell: { bed: { gardenId } } });

const plantingContext = {
  select: {
    id: true,
    variety: true,
    plant: { select: { name: true } },
    cell: { select: { bed: { select: { id: true, name: true } } } },
  },
} as const;

export default async function GardenJournalPage({
  params,
}: {
  params: Promise<{ gardenId: string }>;
}) {
  const { gardenId } = await params;
  const user = await requireUser();

  // Viewers can read the journal — access, not edit.
  const garden = await db.garden.findFirst({
    where: { id: gardenId, ...gardenAccessFilter(user.id) },
    select: { id: true, name: true },
  });
  if (!garden) notFound();

  const [notes, harvests, photos] = await Promise.all([
    // Both flavors of note: garden-level (gardenId set) and planting-level.
    db.growthNote.findMany({
      where: {
        OR: [{ gardenId }, { planting: inGarden(gardenId) }],
      },
      orderBy: { createdAt: "desc" },
      take: PER_TYPE_TAKE,
      include: { planting: plantingContext },
    }),
    db.harvestLog.findMany({
      where: { planting: inGarden(gardenId) },
      orderBy: { harvestedAt: "desc" },
      take: PER_TYPE_TAKE,
      include: { planting: plantingContext },
    }),
    db.plantingPhoto.findMany({
      where: { planting: inGarden(gardenId) },
      orderBy: { takenAt: "desc" },
      take: PER_TYPE_TAKE,
      include: { planting: plantingContext },
    }),
  ]);

  type PlantingCtx = {
    id: string;
    variety: string | null;
    plant: { name: string };
    cell: { bed: { id: string; name: string } };
  } | null;

  const ctx = (p: PlantingCtx): Entry["planting"] =>
    p
      ? {
          plantName: p.plant.name,
          variety: p.variety,
          bedName: p.cell.bed.name,
          href: `/garden/${gardenId}/beds/${p.cell.bed.id}/plantings/${p.id}`,
        }
      : null;

  const entries: Entry[] = [
    ...notes.map((n) => ({
      key: `note-${n.id}`,
      kind: "note" as const,
      at: n.createdAt,
      planting: ctx(n.planting),
      body: n.body,
      yieldLabel: null,
      photoUrl: null,
    })),
    ...harvests.map((h) => ({
      key: `harvest-${h.id}`,
      kind: "harvest" as const,
      at: h.harvestedAt,
      planting: ctx(h.planting),
      body: h.notes,
      yieldLabel: `${h.quantity} ${h.unit}`,
      photoUrl: null,
    })),
    ...photos.map((p) => ({
      key: `photo-${p.id}`,
      kind: "photo" as const,
      at: p.takenAt,
      planting: ctx(p.planting),
      body: p.caption,
      yieldLabel: null,
      photoUrl: p.url,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const truncated = entries.length > MERGED_CAP;
  const timeline = entries.slice(0, MERGED_CAP);

  const stamp = (d: Date) =>
    new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);

  const KIND_META: Record<
    Entry["kind"],
    { label: string; bg: string; fg: string }
  > = {
    note: { label: "Note", bg: "#E4F0D4", fg: "#1C3D0A" },
    harvest: { label: "Harvest", bg: "#FDF2E0", fg: "#D4820A" },
    photo: { label: "Photo", bg: "#F4F4EC", fg: "#6B6B5A" },
  };

  return (
    <div className="container-narrow">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="px-[22px] md:px-8 pt-6 pb-5" style={{ borderBottom: "1px solid #E4E4DC" }}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#7DA84E", marginBottom: "6px" }}>
              <span style={{ display: "block", width: "16px", height: "1.5px", background: "#7DA84E", borderRadius: "1px", flexShrink: 0 }} />
              The Journal · {garden.name}
            </div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 4vw, 30px)", fontWeight: 800, color: "#111109", letterSpacing: "-0.03em", lineHeight: 1, fontVariationSettings: "'opsz' 32" }}>
              What the garden <em style={{ fontStyle: "italic", color: "#1C3D0A" }}>told you</em>.
            </h1>
          </div>
          <Link
            href={`/garden/${gardenId}`}
            className="shrink-0"
            style={{ fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 600, padding: "7px 16px 7px 12px", borderRadius: "8px", border: "1.5px solid #E4E4DC", color: "#3A3A30", textDecoration: "none", lineHeight: 1.2, display: "inline-flex", alignItems: "center", gap: "4px" }}
          >
            <ChevronLeft className="w-3.5 h-3.5" style={{ color: "#6B6B5A" }} aria-hidden="true" />
            Back to garden
          </Link>
        </div>
      </div>

      {/* ── Timeline ─────────────────────────────────────────────────────── */}
      <div className="px-[22px] md:px-8 py-5">
        {timeline.length === 0 ? (
          <div className="text-center py-16">
            <StickyNote className="w-10 h-10 mx-auto mb-3 text-[#E4E4DC]" />
            <p className="font-display text-lg font-semibold text-[#1C3D0A]">
              The journal&apos;s waiting for its first entry.
            </p>
            <p className="text-sm text-[#6B6B5A] mt-1">
              Log a harvest, add a photo, or leave a note — it all lands here.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2 stagger-rise">
              {timeline.map((e) => {
                const meta = KIND_META[e.kind];
                const Icon = e.kind === "note" ? StickyNote : e.kind === "harvest" ? Scissors : Camera;
                const inner = (
                  <div className="flex gap-3 items-start rounded-xl border border-[#E4E4DC] bg-[#FDFDF8] px-4 py-3">
                    {/* Type icon */}
                    <div
                      className="shrink-0 flex items-center justify-center rounded-full"
                      style={{ width: 30, height: 30, background: meta.bg, color: meta.fg, marginTop: 2 }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Stamp line */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#ADADAA" }}>
                          {stamp(e.at)}
                        </span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: meta.fg }}>
                          {meta.label}
                        </span>
                      </div>
                      {/* Who/where */}
                      <p className="text-sm font-medium text-[#111109] mt-0.5">
                        {e.planting ? (
                          <>
                            <em className="font-display" style={{ fontStyle: "italic", color: "#1C3D0A" }}>
                              {e.planting.plantName}
                            </em>
                            {e.planting.variety && (
                              <span className="text-[#6B6B5A]"> · {e.planting.variety}</span>
                            )}
                            <span className="text-[#ADADAA]"> · {e.planting.bedName}</span>
                          </>
                        ) : (
                          <em className="font-display" style={{ fontStyle: "italic", color: "#1C3D0A" }}>
                            The whole garden
                          </em>
                        )}
                        {e.yieldLabel && (
                          <span className="font-semibold text-[#D4820A]"> — {e.yieldLabel}</span>
                        )}
                      </p>
                      {/* Body / caption */}
                      {e.body && (
                        <p className="text-sm text-[#3A3A30] mt-1 whitespace-pre-wrap break-words">
                          {e.body}
                        </p>
                      )}
                      {/* Photo thumb */}
                      {e.photoUrl && (
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-[#F4F4EC] mt-2">
                          <Image
                            src={e.photoUrl}
                            alt={e.body ?? "Garden photo"}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
                return e.planting ? (
                  <Link key={e.key} href={e.planting.href} className="block no-underline">
                    {inner}
                  </Link>
                ) : (
                  <div key={e.key}>{inner}</div>
                );
              })}
            </div>
            {truncated && (
              <p className="text-center text-xs text-[#ADADAA] mt-5" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Showing the latest {MERGED_CAP} entries
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
