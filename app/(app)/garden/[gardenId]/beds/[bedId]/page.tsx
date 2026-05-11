import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function BedPage({
  params,
}: {
  params: Promise<{ gardenId: string; bedId: string }>;
}) {
  const { gardenId, bedId } = await params;
  const user = await requireUser();

  const bed = await db.bed.findFirst({
    where: { id: bedId, gardenId, garden: { userId: user.id } },
    include: {
      garden: { select: { name: true, usdaZone: true, lastFrostDate: true, firstFrostDate: true } },
      cells: {
        include: {
          plantings: {
            where: { season: { isActive: true } },
            include: { plant: { select: { name: true, category: true } } },
          },
        },
        orderBy: [{ row: "asc" }, { col: "asc" }],
      },
    },
  });

  if (!bed) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href={`/garden/${gardenId}`}
        className="inline-flex items-center gap-1 text-sm text-[#6B6560] hover:text-[#2D5016] mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        {bed.garden.name}
      </Link>

      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold text-[#1C1C1A]">
          {bed.name}
        </h1>
        <p className="text-[#6B6560] text-sm mt-1">
          {bed.widthFt} × {bed.heightFt} ft · {bed.gridCols} × {bed.gridRows}{" "}
          grid · {bed.cellSizeIn}&quot; cells
        </p>
      </header>

      {/* Grid — Phase 3 adds full interactive canvas */}
      <div
        className="grid gap-0.5 bg-[#E8E2D9] rounded-xl overflow-hidden border border-[#E8E2D9]"
        style={{
          gridTemplateColumns: `repeat(${bed.gridCols}, minmax(0, 1fr))`,
        }}
      >
        {bed.cells.map((cell) => {
          const planting = cell.plantings[0];
          return (
            <div
              key={cell.id}
              className={`aspect-square flex items-center justify-center text-[10px] font-medium transition-colors ${
                planting
                  ? "bg-[#4A7C2F] text-white"
                  : "bg-[#FAF7F2] text-[#9E9890] hover:bg-[#F5F0E8]"
              }`}
              title={planting ? planting.plant.name : `Row ${cell.row + 1}, Col ${cell.col + 1}`}
            >
              {planting && bed.gridCols <= 12 ? planting.plant.name.slice(0, 3) : ""}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-center text-[#9E9890] mt-4">
        Interactive plant placement coming in Phase 3.
      </p>
    </div>
  );
}
