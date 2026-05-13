import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BottomNav } from "@/components/layout/BottomNav";
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

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F5EDDA" }}>
      {trialDaysLeft !== null && trialDaysLeft <= 5 && (
        <TrialBanner daysLeft={trialDaysLeft} />
      )}

      {/* Top header — dark wood */}
      <header
        className="sticky top-0 z-40 wood-grain"
        style={{
          boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
        }}
      >
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <span
            className="font-display text-xl font-semibold italic tracking-tight"
            style={{
              color: "#F5EDDA",
              fontVariationSettings: "'opsz' 32",
              letterSpacing: "-0.01em",
            }}
          >
            bare root
          </span>
          <NotificationBell reminders={bellReminders} unreadCount={bellReminders.length} />
        </div>
      </header>

      <main className="flex-1 pb-24">{children}</main>

      <BottomNav />
      <PwaInstallPrompt />
    </div>
  );
}
