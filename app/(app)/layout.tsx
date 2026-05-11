import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BottomNav } from "@/components/layout/BottomNav";
import { NotificationBell } from "@/components/layout/NotificationBell";

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

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
      {/* Top header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-[#E8E2D9]">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-display text-lg font-semibold text-[#2D5016]">Bare Root</span>
          <NotificationBell reminders={bellReminders} unreadCount={bellReminders.length} />
        </div>
      </header>

      <main className="flex-1 pb-24">{children}</main>

      <BottomNav />
    </div>
  );
}
