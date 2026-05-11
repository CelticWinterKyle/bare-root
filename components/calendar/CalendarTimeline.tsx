import Link from "next/link";
import { Sprout, ArrowUpFromLine, Apple } from "lucide-react";

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
};

const EVENT_CONFIG = {
  START_SEEDS: {
    label: "Start seeds",
    Icon: Sprout,
    color: "text-[#D4A843]",
    bg: "bg-[#FFF8E7]",
    border: "border-yellow-200",
  },
  TRANSPLANT: {
    label: "Transplant",
    Icon: ArrowUpFromLine,
    color: "text-[#6B8F47]",
    bg: "bg-[#F5F0E8]",
    border: "border-[#E8E2D9]",
  },
  HARVEST: {
    label: "Harvest",
    Icon: Apple,
    color: "text-[#C4790A]",
    bg: "bg-[#FFF3E8]",
    border: "border-orange-200",
  },
} as const;

export function CalendarTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="text-center py-16 text-[#9E9890]">
        <Sprout className="w-10 h-10 mx-auto mb-3 text-[#E8E2D9]" />
        <p className="text-sm">No upcoming planting events.</p>
        <p className="text-xs mt-1">
          Add plants to an active season bed to see your calendar.
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
    <div className="space-y-8">
      {months.map((monthKey) => {
        const [year, month] = monthKey.split("-").map(Number);
        const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });
        const monthEvents = byMonth[monthKey].sort((a, b) => +a.date - +b.date);

        return (
          <div key={monthKey}>
            <h3 className="font-display text-lg font-semibold text-[#1C1C1A] mb-3 pb-2 border-b border-[#E8E2D9]">
              {monthLabel}
            </h3>
            <div className="space-y-2">
              {monthEvents.map((event, i) => {
                const cfg = EVENT_CONFIG[event.type];
                const Icon = cfg.Icon;
                const dayLabel = event.date.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });

                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${cfg.bg} ${cfg.border}`}
                  >
                    <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-white border ${cfg.border}`}>
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className="text-xs text-[#9E9890]">{dayLabel}</span>
                      </div>
                      <p className="text-sm font-medium text-[#1C1C1A] truncate">
                        <Link href={`/plants/${event.plantId}`} className="hover:text-[#2D5016] transition-colors">
                          {event.plantName}
                        </Link>
                      </p>
                      <p className="text-xs text-[#9E9890]">
                        {event.gardenName} · {event.bedName}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
