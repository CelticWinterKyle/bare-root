import { db } from "@/lib/db";
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
};

export async function createRemindersForPlanting(input: ReminderInput): Promise<void> {
  const { plantingId, gardenId, userId, plant, garden, plantedDate } = input;
  const now = new Date();

  type ReminderCreate = {
    userId: string;
    plantingId: string;
    gardenId: string;
    type: string;
    title: string;
    body: string;
    scheduledAt: Date;
  };

  const reminders: ReminderCreate[] = [];

  if (garden.lastFrostDate) {
    if (plant.indoorStartWeeks != null && plant.indoorStartWeeks > 0) {
      const startSeeds = calculateStartSeedsDate(garden.lastFrostDate, plant.indoorStartWeeks);
      if (startSeeds > now) {
        reminders.push({
          userId,
          plantingId,
          gardenId,
          type: "START_SEEDS",
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
          type: "TRANSPLANT",
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
        type: "HARVEST",
        title: `${plant.name} may be ready to harvest`,
        body: `Your ${plant.name} planted on ${plantedDate.toLocaleDateString()} should be ready around now.`,
        scheduledAt: harvest,
      });
    }
  }

  if (reminders.length > 0) {
    await db.reminder.createMany({ data: reminders });
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
    where: { plantingId, type: "HARVEST" },
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
        type: "HARVEST",
        title: `${plantName} may be ready to harvest`,
        body: `Your ${plantName} planted on ${plantedDate.toLocaleDateString()} should be ready around now.`,
        scheduledAt: harvest,
      },
    });
  }
}
