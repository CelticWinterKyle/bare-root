"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, LayoutGrid, CalendarDays,
  BookOpen, Package, Bell, Settings,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    label: "Planning",
    items: [
      { href: "/dashboard", Icon: LayoutDashboard, label: "Dashboard" },
      { href: "/garden",    Icon: LayoutGrid,       label: "Garden" },
      { href: "/calendar",  Icon: CalendarDays,     label: "Calendar" },
    ],
  },
  {
    label: "Library",
    items: [
      { href: "/plants",    Icon: BookOpen, label: "Plants" },
      { href: "/inventory", Icon: Package,  label: "Inventory" },
    ],
  },
  {
    label: "Activity",
    items: [
      { href: "/reminders", Icon: Bell, label: "Reminders" },
    ],
  },
];

export function DesktopSidebar({
  userName,
  userInitial,
  isPro,
  unreadCount,
}: {
  userName: string | null;
  userInitial: string;
  isPro: boolean;
  unreadCount: number;
}) {
  const pathname = usePathname();

  function navItemStyle(href: string) {
    const isActive = pathname.startsWith(href);
    return {
      display: "flex" as const,
      alignItems: "center" as const,
      gap: "9px",
      padding: "8px 18px",
      fontSize: "13px",
      fontWeight: isActive ? 600 : 500,
      fontFamily: "var(--font-body)",
      color: isActive ? "#1C3D0A" : "#6B6B5A",
      borderLeft: `2px solid ${isActive ? "#1C3D0A" : "transparent"}`,
      background: isActive ? "#E4F0D4" : "transparent",
      borderRadius: "0 8px 8px 0",
      marginRight: "8px",
      textDecoration: "none" as const,
      transition: "all 0.12s",
    };
  }

  return (
    <aside style={{
      width: "210px",
      flexShrink: 0,
      background: "#FDFDF8",
      borderRight: "1px solid #E4E4DC",
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      position: "sticky",
      top: 0,
    }}>
      {/* Logo */}
      <div style={{
        padding: "22px 20px 18px",
        borderBottom: "1px solid #E4E4DC",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexShrink: 0,
      }}>
        <div style={{
          width: "32px", height: "32px",
          background: "#1C3D0A", borderRadius: "9px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "16px", flexShrink: 0,
        }}>
          🌿
        </div>
        <div>
          <div style={{
            fontFamily: "var(--font-display)", fontStyle: "italic",
            fontSize: "18px", fontWeight: 800, color: "#111109",
            letterSpacing: "-0.025em", lineHeight: 1,
            fontVariationSettings: "'opsz' 20",
          }}>
            bare root
          </div>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: "8px",
            letterSpacing: "0.15em", textTransform: "uppercase",
            color: "#ADADAA", marginTop: "1px",
          }}>
            Garden Planner
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: "8px" }}>
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} style={{ padding: "14px 0 6px" }}>
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: "8px",
              letterSpacing: "0.2em", textTransform: "uppercase",
              color: "#ADADAA", padding: "0 18px 6px",
            }}>
              {section.label}
            </div>
            {section.items.map(({ href, Icon, label }) => {
              const isActive = pathname.startsWith(href);
              const badge = href === "/reminders" && unreadCount > 0 ? unreadCount : null;
              return (
                <Link key={href} href={href} style={navItemStyle(href)}>
                  <Icon
                    style={{ width: "14px", height: "14px", flexShrink: 0, color: isActive ? "#7DA84E" : "#ADADAA" }}
                    strokeWidth={isActive ? 2 : 1.5}
                  />
                  {label}
                  {badge && (
                    <span style={{
                      marginLeft: "auto", background: "#D4820A", color: "white",
                      fontFamily: "var(--font-mono)", fontSize: "9px",
                      padding: "1px 6px", borderRadius: "100px", lineHeight: 1.5,
                    }}>
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}

        {/* Settings */}
        <div style={{ marginTop: "8px" }}>
          <Link href="/settings" style={navItemStyle("/settings")}>
            <Settings
              style={{ width: "14px", height: "14px", flexShrink: 0, color: pathname.startsWith("/settings") ? "#7DA84E" : "#ADADAA" }}
              strokeWidth={pathname.startsWith("/settings") ? 2 : 1.5}
            />
            Settings
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: "14px 18px",
        borderTop: "1px solid #E4E4DC",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexShrink: 0,
      }}>
        <div style={{
          width: "28px", height: "28px", borderRadius: "50%",
          background: "#1C3D0A", display: "flex", alignItems: "center",
          justifyContent: "center", fontFamily: "var(--font-display)",
          fontSize: "12px", fontWeight: 800, color: "white",
          flexShrink: 0, fontVariationSettings: "'opsz' 14",
        }}>
          {userInitial}
        </div>
        <span style={{
          fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 500,
          color: "#3A3A30", flex: 1, whiteSpace: "nowrap",
          overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {userName ?? "Gardener"}
        </span>
        {isPro && (
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "8px",
            letterSpacing: "0.06em", textTransform: "uppercase",
            background: "linear-gradient(135deg, #D4820A, #F0A030)",
            color: "white", padding: "2px 6px", borderRadius: "4px",
            flexShrink: 0,
          }}>
            Pro
          </span>
        )}
      </div>
    </aside>
  );
}
