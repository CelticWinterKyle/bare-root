"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

/**
 * The bed's time control: a horizontal month strip. Picking a month
 * re-queries the page via ?month=YYYY-MM (mirroring the ?season= pattern) so
 * the grid shows that month's occupancy; "Today" clears it. Mobile gets the
 * same strip with scroll-snap and finger-sized targets.
 */
export function MonthScrubber({
  months,
  current,
  currentYm,
}: {
  /** YYYY-MM values, season start → planning horizon. */
  months: string[];
  /** The selected ?month= param (null = today view). */
  current: string | null;
  /** The real current month, for highlighting "now" in the strip. */
  currentYm: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function go(ym: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (ym === null || ym === currentYm) params.delete("month");
    else params.set("month", ym);
    startTransition(() => {
      router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
    });
  }

  function label(ym: string): string {
    const [y, m] = ym.split("-").map(Number);
    const name = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" });
    // Show the year on Januarys and the first entry so the strip stays scannable.
    return m === 1 || ym === months[0] ? `${name} ’${String(y).slice(2)}` : name;
  }

  const selected = current ?? currentYm;

  return (
    <div
      className="flex items-center gap-1 overflow-x-auto pb-1 -mb-1"
      style={{ scrollSnapType: "x proximity", opacity: isPending ? 0.6 : 1, transition: "opacity 0.15s" }}
      role="tablist"
      aria-label="Viewing month"
    >
      {current !== null && current !== currentYm && (
        <button
          type="button"
          onClick={() => go(null)}
          className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
          style={{ background: "#1C3D0A", color: "white" }}
        >
          Today
        </button>
      )}
      {months.map((ym) => {
        const isSelected = ym === selected;
        const isNow = ym === currentYm;
        return (
          <button
            key={ym}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => go(ym)}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
            style={{
              scrollSnapAlign: "center",
              minWidth: 44,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.04em",
              border: `1.5px solid ${isSelected ? "#1C3D0A" : isNow ? "rgba(28,61,10,0.35)" : "#E4E4DC"}`,
              background: isSelected ? "#1C3D0A" : "transparent",
              color: isSelected ? "white" : isNow ? "#1C3D0A" : "#6B6B5A",
            }}
          >
            {label(ym)}
          </button>
        );
      })}
    </div>
  );
}
