import type { Metadata } from "next";
import { requireOwner } from "@/lib/owner";
import { listUsers, summarizeUsers } from "@/app/actions/admin";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { UsersTab } from "@/components/admin/UsersTab";

export const metadata: Metadata = { title: "Admin | Bare Root" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireOwner();
  const users = await listUsers();
  const { pro, trialing, newThisWeek } = await summarizeUsers(users);

  return (
    <div className="container-narrow">
      <div className="px-[22px] md:px-8 pt-6 pb-5" style={{ borderBottom: "1px solid #E4E4DC" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 4vw, 30px)", fontWeight: 800, color: "#111109", letterSpacing: "-0.03em", lineHeight: 1, fontVariationSettings: "'opsz' 32" }}>
          Admin
        </h1>
        <p className="mt-2 text-sm" style={{ color: "#6B6B5A" }}>
          {users.length} account{users.length === 1 ? "" : "s"}. {pro} on Pro
          {trialing > 0 ? `, ${trialing} trialing` : ""}.{" "}
          {newThisWeek > 0 ? `${newThisWeek} new this week.` : "No new sign-ups this week."}
        </p>
      </div>
      <div className="px-[22px] md:px-8 py-5">
        <AdminTabs active="users" />
        <UsersTab users={users} />
      </div>
    </div>
  );
}
