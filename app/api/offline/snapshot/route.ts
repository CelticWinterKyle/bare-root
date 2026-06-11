import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenAccessFilter } from "@/lib/permissions";

/**
 * Offline snapshot: everything the /offline page needs to render the user's
 * beds without a network — gardens → beds → per-bed plantings with their
 * footprint cells. Trimmed to display fields; refreshed by OfflineSync on
 * every online page load and stored in IndexedDB.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const gardens = await db.garden.findMany({
    where: gardenAccessFilter(user.id),
    select: {
      id: true,
      name: true,
      beds: {
        select: {
          id: true,
          name: true,
          gridCols: true,
          gridRows: true,
          cellSizeIn: true,
          cells: {
            select: {
              row: true,
              col: true,
              occupiedBy: {
                where: {
                  planting: {
                    OR: [
                      { isPerennial: true, clearedAt: null },
                      { season: { isActive: true } },
                    ],
                  },
                },
                orderBy: { planting: { occupiesFrom: "desc" } },
                select: {
                  isPrimary: true,
                  planting: {
                    select: {
                      id: true,
                      status: true,
                      variety: true,
                      quantityPerCell: true,
                      plant: { select: { name: true, category: true } },
                    },
                  },
                },
              },
            },
            orderBy: [{ row: "asc" }, { col: "asc" }],
          },
        },
      },
    },
  });

  // Flatten to a compact shape: per bed, one entry per planting with its
  // anchor + member cells (the offline grid renders blocks from this).
  const out = gardens.map((g) => ({
    id: g.id,
    name: g.name,
    beds: g.beds.map((b) => {
      const plantings = new Map<
        string,
        {
          id: string;
          plantName: string;
          category: string;
          variety: string | null;
          status: string;
          quantityPerCell: number;
          anchor: { row: number; col: number } | null;
          cells: { row: number; col: number }[];
        }
      >();
      for (const cell of b.cells) {
        const occ = cell.occupiedBy[0];
        if (!occ) continue;
        const p = occ.planting;
        const entry = plantings.get(p.id) ?? {
          id: p.id,
          plantName: p.plant.name,
          category: p.plant.category,
          variety: p.variety,
          status: p.status,
          quantityPerCell: p.quantityPerCell,
          anchor: null,
          cells: [],
        };
        entry.cells.push({ row: cell.row, col: cell.col });
        if (occ.isPrimary) entry.anchor = { row: cell.row, col: cell.col };
        plantings.set(p.id, entry);
      }
      return {
        id: b.id,
        name: b.name,
        gridCols: b.gridCols,
        gridRows: b.gridRows,
        cellSizeIn: b.cellSizeIn,
        plantings: [...plantings.values()],
      };
    }),
  }));

  return NextResponse.json({ generatedAt: new Date().toISOString(), gardens: out });
}
