import { db } from "@/lib/db";
import { ReminderType, type PlantStartMethod } from "@/lib/generated/prisma/enums";
import {
  calculateStartSeedsDate,
  calculateTransplantDate,
  calculateExpectedHarvest,
} from "@/lib/services/planting-calendar";

type ReminderInput = {
  plantingId: string;
  gardenId: string;
  userId: string;
  plant: {
    name: string;
    indoorStartWeeks: number | null;
    transplantWeeks: number | null;
    daysToMaturity: number | null;
  };
  garden: {
    lastFrostDate: string | null;
  };
  plantedDate?: Date | null;
  startMethod?: PlantStartMethod | null;
};

export async function createRemindersForPlanting(input: ReminderInput): Promise<void> {
  const { plantingId, gardenId, userId, plant, garden, plantedDate, startMethod } = input;
  const now = new Date();

  // Direct-sow and buy-a-start put the plant in the ground now, so the
  // indoor-start and frost-relative transplant reminders don't apply — only
  // the harvest reminder does. SEED_INDOORS (or an unset method) keeps the
  // full spring schedule.
  const inGroundNow = startMethod === "DIRECT_SOW" || startMethod === "BUY_START";

  type ReminderCreate = {
    userId: string;
    plantingId: string;
    gardenId: string;
    type: ReminderType;
    title: string;
    body: string;
    scheduledAt: Date;
  };

  const reminders: ReminderCreate[] = [];

  if (!inGroundNow && garden.lastFrostDate) {
    if (plant.indoorStartWeeks != null && plant.indoorStartWeeks > 0) {
      const startSeeds = calculateStartSeedsDate(garden.lastFrostDate, plant.indoorStartWeeks);
      if (startSeeds > now) {
        reminders.push({
          userId,
          plantingId,
          gardenId,
          type: ReminderType.START_SEEDS,
          title: `Start ${plant.name} seeds indoors`,
          body: `Time to start your ${plant.name} seeds — ${plant.indoorStartWeeks} weeks before last frost.`,
          scheduledAt: startSeeds,
        });
      }
    }

    if (plant.transplantWeeks != null) {
      const transplant = calculateTransplantDate(garden.lastFrostDate, plant.transplantWeeks);
      if (transplant > now) {
        reminders.push({
          userId,
          plantingId,
          gardenId,
          type: ReminderType.TRANSPLANT,
          title: `Transplant ${plant.name} outdoors`,
          body: `Your ${plant.name} should be ready to move outside now.`,
          scheduledAt: transplant,
        });
      }
    }
  }

  if (plantedDate && plant.daysToMaturity != null) {
    const harvest = calculateExpectedHarvest(plantedDate, plant.daysToMaturity);
    if (harvest > now) {
      reminders.push({
        userId,
        plantingId,
        gardenId,
        type: ReminderType.HARVEST,
        title: `${plant.name} may be ready to harvest`,
        body: `Your ${plant.name} planted on ${plantedDate.toLocaleDateString()} should be ready around now.`,
        scheduledAt: harvest,
      });
    }
  }

  // Dedupe: planting N cells of the same plant in a bed used to create N
  // identical reminders (same plant, garden, type, and date). Only create a
  // reminder if no equivalent one already exists for this user on that day.
  const deduped: ReminderCreate[] = [];
  for (const r of reminders) {
    const dayStart = new Date(r.scheduledAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const exists = await db.reminder.findFirst({
      where: {
        userId: r.userId,
        gardenId: r.gardenId,
        type: r.type,
        title: r.title,
        scheduledAt: { gte: dayStart, lt: dayEnd },
      },
      select: { id: true },
    });
    if (!exists) deduped.push(r);
  }

  if (deduped.length > 0) {
    await db.reminder.createMany({ data: deduped });
  }
}

export async function upsertHarvestReminder(
  plantingId: string,
  plantedDate: Date,
  daysToMaturity: number,
  userId: string,
  gardenId: string,
  plantName: string
): Promise<void> {
  const now = new Date();
  const harvest = calculateExpectedHarvest(plantedDate, daysToMaturity);

  const existing = await db.reminder.findFirst({
    where: { plantingId, type: ReminderType.HARVEST },
  });

  if (existing) {
    if (harvest > now) {
      await db.reminder.update({
        where: { id: existing.id },
        data: { scheduledAt: harvest, dismissed: false },
      });
    } else {
      await db.reminder.update({
        where: { id: existing.id },
        data: { dismissed: true },
      });
    }
  } else if (harvest > now) {
    await db.reminder.create({
      data: {
        userId,
        plantingId,
        gardenId,
        type: ReminderType.HARVEST,
        title: `${plantName} may be ready to harvest`,
        body: `Your ${plantName} planted on ${plantedDate.toLocaleDateString()} should be ready around now.`,
        scheduledAt: harvest,
      },
    });
  }
}
