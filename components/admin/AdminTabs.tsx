import Link from "next/link";

export type AdminTab = "overview" | "users" | "revenue" | "ai" | "system";

const TABS: { key: AdminTab; label: string; href: string; ready: boolean }[] = [
  { key: "overview", label: "Overview", href: "/admin/overview", ready: false },
  { key: "users", label: "Users", href: "/admin", ready: true },
  { key: "revenue", label: "Revenue", href: "/admin/revenue", ready: false },
  { key: "ai", label: "AI usage", href: "/admin/ai", ready: false },
  { key: "system", label: "System", href: "/admin/system", ready: false },
];

/**
 * Tab strip for the admin page. Tabs that aren't built yet render as
 * muted, unlinked labels so the shape of the finished page is visible
 * without dead links.
 */
export function AdminTabs({ active }: { active: AdminTab }) {
  return (
    <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "#E4E4DC" }}>
      {TABS.map((t) => {
        const isActive = t.key === active;
        const style: React.CSSProperties = {
          padding: "8px 12px",
          fontSize: "13.5px",
          fontWeight: isActive ? 600 : 500,
          color: isActive ? "#1C3D0A" : t.ready ? "#3A3A30" : "#6B6B5A",
          borderBottom: `2px solid ${isActive ? "#1C3D0A" : "transparent"}`,
          marginBottom: "-1px",
          opacity: t.ready ? 1 : 0.55,
        };
        return t.ready ? (
          <Link key={t.key} href={t.href} style={style}>
            {t.label}
          </Link>
        ) : (
          <span key={t.key} style={style} title="Coming in a later phase">
            {t.label}
          </span>
        );
      })}
    </div>
  );
}
