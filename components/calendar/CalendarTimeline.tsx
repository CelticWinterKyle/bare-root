import Link from "next/link";
import { Sprout, ArrowUpFromLine, Apple, CalendarClock } from "lucide-react";

export type CalendarEvent = {
  date: Date;
  type: "START_SEEDS" | "TRANSPLANT" | "HARVEST";
  plantName: string;
  plantId: string;
  bedName: string;
  gardenName: string;
};

type Props = {
  events: CalendarEvent[];
  /** Plantings in active seasons across all the user's gardens, so we can
   *  show a smarter empty state when the user has plants but no events. */
  activePlantingCount?: number;
};

const EVENT_CONFIG = {
  START_SEEDS: {
    label: "Start seeds",
    Icon: Sprout,
    dot: "#D4A843",
    dotBg: "#FFF8E7",
    text: "#92700A",
  },
  TRANSPLANT: {
    label: "Transplant",
    Icon: ArrowUpFromLine,
    dot: "#7DA84E",
    dotBg: "#EEF6E7",
    text: "#3E5F22",
  },
  HARVEST: {
    label: "Harvest",
    Icon: Apple,
    dot: "#D4820A",
    dotBg: "#FFF3E8",
    text: "#8A4F00",
  },
} as const;

export function CalendarTimeline({ events, activePlantingCount = 0 }: Props) {
  if (events.length === 0) {
    // Two flavors of "empty":
    //  - No plantings at all → guide them to plant something
    //  - Plantings exist but no events → the plants are missing grow-cycle
    //    data (indoorStartWeeks / transplantWeeks / expectedHarvestDate),
    //    so the calendar can't build entries. Setting planted dates in the
    //    bed view computes expectedHarvestDate and fills the calendar in.
    if (activePlantingCount === 0) {
      return (
        <div className="text-center py-16 text-[#ADADAA]">
          <Sprout className="w-10 h-10 mx-auto mb-3 text-[#E4E4DC]" />
          <p className="text-sm">No upcoming planting events.</p>
          <p className="text-xs mt-1">
            Add plants to an active season bed to see your calendar.
          </p>
        </div>
      );
    }
    return (
      <div className="text-center py-16 text-[#ADADAA]">
        <CalendarClock className="w-10 h-10 mx-auto mb-3 text-[#E4E4DC]" />
        <p className="text-sm text-[#6B6B5A]">
          You have {activePlantingCount} planting{activePlantingCount === 1 ? "" : "s"}, but no calendar events yet.
        </p>
        <p className="text-xs mt-2 max-w-sm mx-auto leading-relaxed">
          Set a planted date on each planting (from the bed view) to fill in
          start-seed, transplant, and estimated harvest dates here.
        </p>
      </div>
    );
  }

  // Group by YYYY-MM
  const byMonth: Record<string, CalendarEvent[]> = {};
  for (const event of events) {
    const key = event.date.toISOString().slice(0, 7);
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(event);
  }

  const months = Object.keys(byMonth).sort();

  return (
    <div className="space-y-10">
      {months.map((monthKey) => {
        const [year, month] = monthKey.split("-").map(Number);
        const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });
        const monthEvents = byMonth[monthKey].sort((a, b) => +a.date - +b.date);

        return (
          <div key={monthKey}>
            {/* Month header */}
            <div className="flex items-center gap-3 mb-4">
              <h3 className="font-display text-base font-semibold text-[#111109]">
                {monthLabel}
              </h3>
              <div className="flex-1 h-px bg-[#E4E4DC]" />
              <span className="text-xs font-medium text-[#ADADAA] bg-[#F4F4EC] px-2 py-0.5 rounded-full">
                {monthEvents.length} {monthEvents.length === 1 ? "event" : "events"}
              </span>
            </div>

            {/* Timeline items */}
            <div className="relative pl-10">
              {/* Vertical rail */}
              <div className="absolute left-3.5 top-3 bottom-3 w-px bg-[#E4E4DC]" />

              <div className="space-y-3">
                {monthEvents.map((event, i) => {
                  const cfg = EVENT_CONFIG[event.type];
                  const Icon = cfg.Icon;
                  const dayNum = event.date.getDate();
                  const dayName = event.date.toLocaleDateString("en-US", { weekday: "short" });

                  return (
                    <div key={i} className="flex items-start gap-3 group/item">
                      {/* Dot on rail */}
                      <div
                        className="absolute left-[5px] w-5 h-5 rounded-full border-2 border-white flex items-center justify-center z-10 shadow-sm"
                        style={{ background: cfg.dot, marginTop: "10px" }}
                      >
                        <Icon className="w-2.5 h-2.5 text-white" />
                      </div>

                      {/* Card */}
                      <div
                        className="flex-1 rounded-xl border p-3.5 transition-shadow hover:shadow-sm"
                        style={{ background: cfg.dotBg, borderColor: cfg.dot + "33" }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span
                                className="text-xs font-semibold uppercase tracking-wide"
                                style={{ color: cfg.text }}
                              >
                                {cfg.label}
                              </span>
                              <span className="text-xs text-[#ADADAA]">
                                {dayName}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-[#111109] truncate">
                              <Link
                                href={`/plants/${event.plantId}`}
                                className="hover:text-[#1C3D0A] transition-colors"
                              >
                                {event.plantName}
                              </Link>
                            </p>
                            <p className="text-xs text-[#ADADAA] mt-0.5">
                              {event.gardenName} · {event.bedName}
                            </p>
                          </div>

                          {/* Day badge */}
                          <div
                            className="shrink-0 w-10 text-center rounded-lg py-1"
                            style={{ background: cfg.dot + "22" }}
                          >
                            <div
                              className="text-xl font-bold leading-none"
                              style={{ color: cfg.dot }}
                            >
                              {dayNum}
                            </div>
                            <div className="text-[9px] font-medium mt-0.5" style={{ color: cfg.text }}>
                              {event.date.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
