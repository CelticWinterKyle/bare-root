"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// The app's working vocabulary, in plain words. Mono term + short body,
// Glasshouse voice — explains the concepts, not the buttons.
const ENTRIES: { term: string; body: string }[] = [
  {
    term: "Seasons",
    body: "Everything you plant lives inside a season — one active at a time per garden. When a season ends, its plantings become history you can look back on; the beds clear for the next one.",
  },
  {
    term: "Beds & cells",
    body: "A bed is a grid of square cells (usually 12\" each). One cell holds one small plant; bigger plants take more.",
  },
  {
    term: "Footprint & spacing",
    body: "Every plant has a spacing — how much room it needs to breathe. A tomato wanting 18\" claims a block of cells (its footprint), which is why one planting can fill several squares.",
  },
  {
    term: "Start methods",
    body: "Three ways into the soil: start seeds indoors (weeks before frost, then transplant out), direct sow (seeds straight in the bed), or buy a start (a nursery seedling, planted out). The calendar and reminders follow whichever you choose.",
  },
  {
    term: "Sun levels",
    body: "Each cell can be mapped as full sun, partial sun, partial shade, or full shade — the real light it gets after fences, trees, and the house have their say. Suggestions respect the map.",
  },
  {
    term: "Companion pairs",
    body: "Some neighbors help each other; some quarrel. A green dot on a cell means a beneficial pairing nearby, a rust dot means a conflict. Advisory only — the garden never stops you.",
  },
  {
    term: "Frost dates",
    body: "Your last spring frost and first fall frost bracket the growing year. They drive what's safe to plant when, plus the cold-night alerts. Set them in garden settings.",
  },
  {
    term: "Reminders",
    body: "Reminders close the loop: marking \"start seeds,\" \"transplant,\" or \"harvest\" as done updates the planting itself — its status moves along and the next reminder lines up.",
  },
];

/**
 * Slide-over glossary — the app's terms explained in 8 short entries.
 * Controlled (open/onOpenChange) so any "?" button or coach mark can
 * summon it.
 */
export function HelpSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="overflow-y-auto"
        style={{ background: "#FDFDF8", borderColor: "#E4E4DC" }}
      >
        <SheetHeader style={{ borderBottom: "1px solid #E4E4DC", paddingBottom: 14 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#7DA84E",
              fontWeight: 500,
            }}
          >
            Field guide
          </span>
          <SheetTitle
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "-0.025em",
              color: "#111109",
              lineHeight: 1.1,
              fontVariationSettings: "'opsz' 28",
            }}
          >
            How the <em style={{ fontStyle: "italic", color: "#1C3D0A" }}>garden</em> works.
          </SheetTitle>
          <SheetDescription style={{ fontSize: 13, color: "#6B6B5A", lineHeight: 1.45 }}>
            The handful of terms the app leans on, in plain words.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-8 flex flex-col gap-5">
          {ENTRIES.map((e) => (
            <div key={e.term}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "#1C3D0A",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                {e.term}
              </div>
              <p style={{ fontSize: 13, color: "#3A3A30", lineHeight: 1.55 }}>{e.body}</p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
