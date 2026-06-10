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
    throw new Error(`Bed dimensions must be between 0 and ${MAX_BED_FT} ft`);
  }
  const { widthFt, heightFt, cellSizeIn } = parsed.data;
  const gridCols = Math.max(1, Math.floor(widthFt * (12 / cellSizeIn)));
  const gridRows = Math.max(1, Math.floor(heightFt * (12 / cellSizeIn)));
  if (gridCols * gridRows > MAX_BED_CELLS) {
    throw new Error(
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
    throw new Error(`Garden dimensions must be between 0 and ${MAX_GARDEN_FT} ft`);
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
  if (!ext) throw new Error("Photos must be JPEG, PNG, WebP, AVIF, or GIF");
  if (file.size > MAX_PHOTO_BYTES) throw new Error("Photos must be 10 MB or smaller");
  return ext;
}
