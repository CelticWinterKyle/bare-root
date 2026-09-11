import { ActionError } from "@/lib/action-error";
import { z } from "zod";

/**
 * Shared input bounds for server actions. Every number here is far above
 * anything a real garden needs — they exist so a hand-crafted request can't
 * make the server generate unbounded work (a 9999-ft bed is a ~million-row
 * cell.createMany; an unbounded bulk-assign is thousands of serial
 * transactions).
 */

export const MAX_BED_FT = 100;
export const MAX_BED_CELLS = 5000;
export const MAX_GARDEN_FT = 1000;
export const MAX_BULK_CELLS = 500;
// Carry-over replants run the full assignPlant path (several queries + a
// transaction each, serially) — bound it like bulk assign.
export const MAX_CARRY_OVER_PLANTINGS = 100;

const bedDimensionsSchema = z.object({
  widthFt: z.number().finite().positive().max(MAX_BED_FT),
  heightFt: z.number().finite().positive().max(MAX_BED_FT),
  cellSizeIn: z.union([z.literal(12), z.literal(6)]),
});

/**
 * Validate bed dimensions and derive the grid size. Throws a user-facing
 * message on bad input; returns the grid so callers can't recompute it
 * differently from what was validated.
 */
export function validateBedDimensions(input: {
  widthFt: number;
  heightFt: number;
  cellSizeIn: 12 | 6;
}): { gridCols: number; gridRows: number } {
  const parsed = bedDimensionsSchema.safeParse(input);
  if (!parsed.success) {
    throw new ActionError("INVALID_INPUT", `Bed dimensions must be between 0 and ${MAX_BED_FT} ft`);
  }
  const { widthFt, heightFt, cellSizeIn } = parsed.data;
  const gridCols = Math.max(1, Math.floor(widthFt * (12 / cellSizeIn)));
  const gridRows = Math.max(1, Math.floor(heightFt * (12 / cellSizeIn)));
  if (gridCols * gridRows > MAX_BED_CELLS) {
    throw new ActionError("INVALID_INPUT", 
      `That bed would have ${gridCols * gridRows} cells — the limit is ${MAX_BED_CELLS}. Try a smaller bed or 12" cells.`
    );
  }
  return { gridCols, gridRows };
}

export const gardenDimensionsSchema = z.object({
  widthFt: z.number().finite().positive().max(MAX_GARDEN_FT),
  heightFt: z.number().finite().positive().max(MAX_GARDEN_FT),
});

export function validateGardenDimensions(input: { widthFt: number; heightFt: number }): void {
  if (!gardenDimensionsSchema.safeParse(input).success) {
    throw new ActionError("INVALID_INPUT", `Garden dimensions must be between 0 and ${MAX_GARDEN_FT} ft`);
  }
}

const isoDate = z
  .string()
  .refine((s) => !Number.isNaN(new Date(s).getTime()), "Invalid date");

export const seasonInputSchema = z.object({
  name: z.string().trim().min(1, "Season name is required").max(100),
  startDate: isoDate,
  endDate: isoDate.optional(),
  setActive: z.boolean(),
});

export const customReminderSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  body: z.string().trim().max(2000).optional(),
  scheduledAt: isoDate,
  gardenId: z.string().optional(),
  repeat: z.enum(["weekly", "monthly"]).optional(),
});

// "Remind me" on a calendar succession suggestion. plantName is only a
// display fallback — the action re-reads the canonical name from the DB.
export const successionReminderSchema = z.object({
  plantId: z.string().min(1, "Plant is required"),
  gardenId: z.string().min(1, "Garden is required"),
  suggestedDate: isoDate,
  plantName: z.string().trim().min(1).max(200),
});

// Garden-level journal note ("aphids on the east bed") — see addGardenNote.
export const gardenNoteSchema = z.object({
  gardenId: z.string().min(1, "Garden is required"),
  body: z.string().trim().min(1, "Write a note first").max(2000),
});

// Browser-renderable raster formats only (no SVG — scriptable; no HEIC —
// won't render in <img>, and iOS transcodes to JPEG on web upload anyway).
export const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** Throws on bad uploads; returns the extension derived from the validated MIME type. */
export function validatePhotoUpload(file: File): string {
  const ext = ALLOWED_PHOTO_TYPES[file.type];
  if (!ext) throw new ActionError("INVALID_INPUT", "Photos must be JPEG, PNG, WebP, AVIF, or GIF");
  if (file.size > MAX_PHOTO_BYTES) throw new ActionError("INVALID_INPUT", "Photos must be 10 MB or smaller");
  return ext;
}

// ─── Free-text and numeric bounds ─────────────────────────────────────────────
// Every user-typed string gets a ceiling. Nothing here is a real limit for a
// gardener; they exist so a hand-crafted request can't store megabytes per
// row or make a page render unbounded text.
export const MAX_NAME_CHARS = 100;
export const MAX_NOTES_CHARS = 2000;
export const MAX_CAPTION_CHARS = 200;
export const MAX_UNIT_CHARS = 20;
export const MAX_HARVEST_QUANTITY = 100_000;
export const MAX_OPEN_CUSTOM_REMINDERS = 200;
export const MAX_INVITES_PER_DAY = 10;

/** Trimmed text or null when blank; throws when over `max`. */
export function optionalText(value: unknown, label: string, max: number): string | null {
  const t = typeof value === "string" ? value.trim() : "";
  if (!t) return null;
  if (t.length > max) {
    throw new ActionError("INVALID_INPUT", `${label} must be ${max} characters or fewer`);
  }
  return t;
}

/** Trimmed text; throws when blank or over `max`. */
export function requiredText(value: unknown, label: string, max: number): string {
  const t = optionalText(value, label, max);
  if (!t) throw new ActionError("INVALID_INPUT", `${label} is required`);
  return t;
}

export const harvestLogSchema = z.object({
  quantity: z.number().finite().positive().max(MAX_HARVEST_QUANTITY),
  unit: z.string().trim().min(1).max(MAX_UNIT_CHARS),
  notes: z.string().trim().max(MAX_NOTES_CHARS).optional(),
  harvestedAt: z.string().max(40).optional(),
  clientId: z.string().max(64).optional(),
});

export const seedInventorySchema = z.object({
  plantId: z.string().min(1).max(64),
  variety: z.string().trim().max(MAX_NAME_CHARS),
  quantity: z.number().finite().min(0).max(MAX_HARVEST_QUANTITY),
  unit: z.string().trim().min(1).max(MAX_UNIT_CHARS),
  notes: z.string().trim().max(MAX_NOTES_CHARS).optional(),
});

/**
 * MM-DD frost date or null. Throws on anything else — an unchecked string
 * like "13-99" silently rolls over into a wrong date downstream (JS Date
 * overflow), producing plausible-but-wrong reminder timing.
 */
export function validateFrostMmdd(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  if (!t) return null;
  const m = /^(\d{2})-(\d{2})$/.exec(t);
  const month = m ? Number(m[1]) : 0;
  const day = m ? Number(m[2]) : 0;
  if (!m || month < 1 || month > 12 || day < 1 || day > 31) {
    throw new ActionError("INVALID_INPUT", "Frost date must be a valid MM-DD (e.g. 04-15)");
  }
  return t;
}
