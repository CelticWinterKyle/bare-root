"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LayoutGrid, BookOpen, CalendarDays, Bell } from "lucide-react";

const tabs = [
  { href: "/dashboard", label: "Home",     icon: LayoutDashboard },
  { href: "/garden",    label: "Garden",   icon: LayoutGrid },
  { href: "/plants",    label: "Plants",   icon: BookOpen },
  { href: "/calendar",  label: "Calendar", icon: CalendarDays },
  { href: "/reminders", label: "Alerts",   icon: Bell },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 safe-area-inset-bottom"
      style={{
        background: "#FDFDF8",
        borderTop: "1px solid #E4E4DC",
        padding: "8px 16px 12px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        className="flex items-center gap-0.5"
        style={{
          background: "#111109",
          borderRadius: 100,
          padding: "6px 8px",
          boxShadow: "0 4px 20px rgba(17,17,9,0.25)",
        }}
      >
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 transition-colors"
              style={{
                padding: "6px 12px",
                borderRadius: 100,
                minWidth: 52,
                background: isActive ? "#1C3D0A" : "transparent",
              }}
            >
              <Icon
                className="w-4 h-4"
                strokeWidth={isActive ? 2 : 1.5}
                style={{ color: isActive ? "#A8D870" : "rgba(255,255,255,0.3)" }}
              />
              <span
                className="font-mono leading-none"
                style={{
                  fontSize: 7,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)",
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
