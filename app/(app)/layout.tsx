"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Sprout, BookOpen, CalendarDays, Settings } from "lucide-react";

const tabs = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/garden", label: "Garden", icon: Sprout },
  { href: "/plants", label: "Plants", icon: BookOpen },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
      <main className="flex-1 pb-20">{children}</main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E8E2D9] z-50 safe-area-inset-bottom">
        <div className="flex items-stretch max-w-lg mx-auto">
          {tabs.map(({ href, label, icon: Icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                  isActive
                    ? "text-[#2D5016]"
                    : "text-[#9E9890] hover:text-[#6B6560]"
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : "stroke-2"}`}
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
