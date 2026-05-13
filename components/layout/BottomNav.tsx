"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LayoutGrid, BookOpen, CalendarDays, Settings } from "lucide-react";

const tabs = [
  { href: "/dashboard", label: "Home",     icon: LayoutDashboard },
  { href: "/garden",    label: "Garden",   icon: LayoutGrid },
  { href: "/plants",    label: "Plants",   icon: BookOpen },
  { href: "/calendar",  label: "Calendar", icon: CalendarDays },
  { href: "/settings",  label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 safe-area-inset-bottom wood-grain"
      style={{
        boxShadow: "0 -2px 16px rgba(0,0,0,0.4)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-stretch max-w-lg mx-auto h-16">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors relative"
            >
              {/* Active amber underline */}
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                  style={{ background: "#C4790A" }}
                />
              )}

              <Icon
                className="w-5 h-5 transition-colors"
                strokeWidth={isActive ? 2 : 1.5}
                style={{ color: isActive ? "#E8A030" : "rgba(245,237,218,0.4)" }}
              />
              <span
                className="font-mono text-[9px] uppercase tracking-widest leading-none transition-colors"
                style={{
                  color: isActive ? "rgba(245,237,218,0.9)" : "rgba(245,237,218,0.3)",
                  letterSpacing: "0.12em",
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
