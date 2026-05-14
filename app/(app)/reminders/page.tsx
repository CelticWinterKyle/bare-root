import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenAccessFilter } from "@/lib/permissions";
import { RemindersClient } from "@/components/reminders/RemindersClient";

export default async function RemindersPage() {
  const user = await requireUser();

  const [reminders, gardens] = await Promise.all([
    db.reminder.findMany({
      where: { userId: user.id, dismissed: false },
      orderBy: { scheduledAt: "desc" },
      take: 50,
      include: {
        planting: {
          include: {
            plant: { select: { name: true } },
            cell: { include: { bed: { select: { id: true, name: true, gardenId: true } } } },
          },
        },
        garden: { select: { id: true, name: true } },
      },
    }),
    db.garden.findMany({
      where: gardenAccessFilter(user.id),
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <RemindersClient
      gardens={gardens}
      reminders={reminders.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        scheduledAt: r.scheduledAt.toISOString(),
        sentAt: r.sentAt?.toISOString() ?? null,
        plantName: r.planting?.plant.name ?? null,
        bedName: r.planting?.cell.bed.name ?? null,
        gardenId: r.planting?.cell.bed.gardenId ?? r.garden?.id ?? null,
        bedId: r.planting?.cell.bed.id ?? null,
        gardenName: r.garden?.name ?? null,
      }))}
    />
  );
}
