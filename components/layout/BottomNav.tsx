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
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-[#E8E2D9] z-50 safe-area-inset-bottom">
      <div className="flex items-stretch max-w-lg mx-auto h-16">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors"
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  isActive
                    ? "bg-[#2D5016] shadow-sm"
                    : "bg-transparent hover:bg-[#F5F0E8]"
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? "text-white" : "text-[#9E9890]"
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>
              <span
                className={`text-[10px] font-medium leading-none transition-colors ${
                  isActive ? "text-[#2D5016]" : "text-[#9E9890]"
                }`}
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
