import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BottomNav } from "@/components/layout/BottomNav";
import { DesktopSidebar } from "@/components/layout/DesktopSidebar";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { TrialBanner } from "@/components/layout/TrialBanner";
import { PwaInstallPrompt } from "@/components/layout/PwaInstallPrompt";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const reminders = await db.reminder.findMany({
    where: { userId: user.id, dismissed: false, sentAt: { not: null } },
    orderBy: { scheduledAt: "desc" },
    take: 10,
    include: {
      planting: {
        include: {
          cell: { include: { bed: { select: { id: true, gardenId: true } } } },
        },
      },
    },
  });

  const bellReminders = reminders.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    gardenId: r.planting?.cell.bed.gardenId ?? null,
    bedId: r.planting?.cell.bed.id ?? null,
  }));

  const isPro = user.subscriptionTier === "PRO";
  const trialDaysLeft =
    isPro && user.trialEndsAt
      ? Math.max(0, Math.ceil((user.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;

  const userInitial = (user.name ?? user.email ?? "G")[0].toUpperCase();
  const unreadCount = bellReminders.length;

  return (
    <div className="min-h-screen" style={{ background: "#FDFDF8" }}>
      {trialDaysLeft !== null && trialDaysLeft <= 5 && (
        <TrialBanner daysLeft={trialDaysLeft} />
      )}

      {/* ── Mobile layout (< md) ─────────────────────────── */}
      <div className="flex flex-col md:hidden min-h-screen">
        <header
          className="sticky top-0 z-40"
          style={{ background: "#FDFDF8", borderBottom: "1px solid #E4E4DC", position: "relative" }}
        >
          <div className="px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="font-display font-bold italic"
                style={{ fontSize: "22px", color: "#1C3D0A", fontVariationSettings: "'opsz' 32", letterSpacing: "-0.025em", lineHeight: 1 }}
              >
                bare root
              </span>
              <span
                className="rounded-full"
                style={{ width: 5, height: 5, background: "#7DA84E", flexShrink: 0, marginBottom: 2 }}
              />
            </div>
            <NotificationBell reminders={bellReminders} unreadCount={unreadCount} />
          </div>
          {/* Green gradient accent line */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: "2px",
            background: "linear-gradient(90deg, #1C3D0A 0%, #7DA84E 60%, transparent 100%)",
            opacity: 0.25,
          }} />
        </header>

        <main className="flex-1 pb-24">{children}</main>
        <BottomNav />
      </div>

      {/* ── Desktop layout (≥ md) ─────────────────────────── */}
      <div className="hidden md:flex min-h-screen">
        <DesktopSidebar
          userName={user.name ?? null}
          userInitial={userInitial}
          isPro={isPro}
          unreadCount={unreadCount}
        />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      <PwaInstallPrompt />
    </div>
  );
}
