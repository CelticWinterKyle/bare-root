"use server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenAccessFilter } from "@/lib/permissions";

export type SearchResults = {
  plants: { id: string; name: string; category: string }[];
  beds: { id: string; name: string; gardenId: string; gardenName: string }[];
  plantings: {
    id: string;
    plantName: string;
    variety: string | null;
    bedId: string;
    bedName: string;
    gardenId: string;
  }[];
};

/**
 * Global search (Cmd-K): three grouped, user-scoped lookups — library
 * plants, the user's beds, and active-season plantings. Each result row
 * deep-links; the client renders the groups.
 */
export async function searchEverything(query: string): Promise<SearchResults> {
  const user = await requireUser();
  const q = query.trim().slice(0, 60);
  if (q.length < 2) return { plants: [], beds: [], plantings: [] };

  const [plants, beds, plantings] = await Promise.all([
    db.plantLibrary.findMany({
      where: {
        OR: [{ customForUserId: null }, { customForUserId: user.id }],
        name: { contains: q, mode: "insensitive" },
      },
      select: { id: true, name: true, category: true },
      orderBy: [{ source: "desc" }, { name: "asc" }],
      take: 6,
    }),
    db.bed.findMany({
      where: {
        garden: gardenAccessFilter(user.id),
        name: { contains: q, mode: "insensitive" },
      },
      select: { id: true, name: true, gardenId: true, garden: { select: { name: true } } },
      take: 5,
    }),
    db.planting.findMany({
      where: {
        season: { isActive: true },
        cell: { bed: { garden: gardenAccessFilter(user.id) } },
        OR: [
          { plant: { name: { contains: q, mode: "insensitive" } } },
          { variety: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        variety: true,
        plant: { select: { name: true } },
        cell: { select: { bed: { select: { id: true, name: true, gardenId: true } } } },
      },
      take: 6,
    }),
  ]);

  return {
    plants,
    beds: beds.map((b) => ({
      id: b.id,
      name: b.name,
      gardenId: b.gardenId,
      gardenName: b.garden.name,
    })),
    plantings: plantings.map((p) => ({
      id: p.id,
      plantName: p.plant.name,
      variety: p.variety,
      bedId: p.cell.bed.id,
      bedName: p.cell.bed.name,
      gardenId: p.cell.bed.gardenId,
    })),
  };
}
