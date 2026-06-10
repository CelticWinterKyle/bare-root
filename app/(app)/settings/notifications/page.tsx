import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationsClient } from "@/components/settings/NotificationsClient";

const REMINDER_TYPES = [
  { type: "START_SEEDS", label: "Start seeds indoors", description: "When it's time to start seeds before last frost" },
  { type: "TRANSPLANT", label: "Transplant outdoors", description: "When seedlings are ready to move outside" },
  { type: "HARVEST", label: "Harvest reminders", description: "When plants are expected to be ready to harvest" },
  { type: "FROST_ALERT", label: "Frost alerts", description: "When freezing temperatures are forecast in the next 72 hours" },
  // WATER and FERTILIZE are deliberately NOT listed: no code ever creates
  // reminders of those types, so showing toggles for them would be a facade.
  // The enum values stay (cheap, and themed in TYPE_CONFIG) — re-add rows
  // here if/when a producer ships.
  { type: "SUCCESSION_PLANTING", label: "Succession planting", description: "Suggestions for follow-on crops" },
  { type: "CUSTOM", label: "Custom reminders", description: "Your own custom reminders" },
] as const;

export default async function NotificationsPage() {
  const user = await requireUser();

  const prefs = await db.notificationPreference.findMany({
    where: { userId: user.id },
  });

  const prefsByType = new Map(prefs.map((p) => [p.type, p]));

  const settings = REMINDER_TYPES.map(({ type, label, description }) => {
    const pref = prefsByType.get(type as never);
    return {
      type,
      label,
      description,
      enabled: pref?.enabled ?? true,
      channelEmail: pref?.channelEmail ?? true,
      channelPush: pref?.channelPush ?? true,
    };
  });

  return <NotificationsClient settings={settings} />;
}
