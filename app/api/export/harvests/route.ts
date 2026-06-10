import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenAccessFilter } from "@/lib/permissions";

/**
 * Harvest log as CSV — every harvest across gardens the user can view
 * (owned + accepted collaborations), newest first, bounded at 5000 rows.
 * Spreadsheet-friendly counterpart to the full zip export at /api/export.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const harvests = await db.harvestLog.findMany({
    where: {
      planting: { cell: { bed: { garden: gardenAccessFilter(user.id) } } },
    },
    orderBy: { harvestedAt: "desc" },
    take: 5000,
    select: {
      harvestedAt: true,
      quantity: true,
      unit: true,
      notes: true,
      planting: {
        select: {
          variety: true,
          plant: { select: { name: true } },
          cell: {
            select: {
              bed: { select: { name: true, garden: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });

  const header = ["date", "plant", "variety", "bed", "garden", "quantity", "unit", "notes"];
  const rows = harvests.map((h) => [
    h.harvestedAt.toISOString().slice(0, 10),
    h.planting.plant.name,
    h.planting.variety ?? "",
    h.planting.cell.bed.name,
    h.planting.cell.bed.garden.name,
    String(h.quantity),
    h.unit,
    h.notes ?? "",
  ]);
  // BOM: Excel mis-decodes plain UTF-8 CSVs (accented variety names).
  const csv =
    "\uFEFF" +
    [header, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n") +
    "\r\n";

  const filename = `harvests-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** RFC 4180 escaping: quote any field containing a comma, quote, or newline. */
function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
