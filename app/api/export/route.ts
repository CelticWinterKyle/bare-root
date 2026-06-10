import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { ZipArchive } from "archiver";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gatherExportData } from "@/lib/export-data";

// Photo downloads are network-bound; give big accounts the full window.
export const maxDuration = 300;

/**
 * Full account export: a zip containing data.json (gardens, beds,
 * plantings, harvests, notes, inventory) plus every photo FILE. Blob URLs
 * alone would die when the account is deleted, so the files themselves
 * are included.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const [data, photos] = await Promise.all([
    gatherExportData(user),
    db.plantingPhoto.findMany({
      where: { planting: { cell: { bed: { garden: { userId: user.id } } } } },
      select: {
        url: true,
        takenAt: true,
        planting: { select: { plant: { select: { name: true } } } },
      },
      orderBy: { takenAt: "asc" },
    }),
  ]);

  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.append(JSON.stringify(data, null, 2), { name: "data.json" });

  // Fetch + append photos asynchronously while the zip streams to the
  // client; finalize once everything is queued. A failed photo fetch is
  // skipped (listed in skipped.txt) rather than failing the export.
  void (async () => {
    const seen = new Map<string, number>();
    const skipped: string[] = [];
    for (const photo of photos) {
      try {
        const res = await fetch(photo.url);
        if (!res.ok || !res.body) {
          skipped.push(photo.url);
          continue;
        }
        const plant = photo.planting.plant.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const day = photo.takenAt.toISOString().slice(0, 10);
        const ext = (new URL(photo.url).pathname.split(".").pop() ?? "jpg").toLowerCase();
        const base = `photos/${plant}-${day}`;
        const n = (seen.get(base) ?? 0) + 1;
        seen.set(base, n);
        archive.append(Readable.fromWeb(res.body as NodeWebReadableStream), {
          name: n === 1 ? `${base}.${ext}` : `${base}-${n}.${ext}`,
        });
      } catch {
        skipped.push(photo.url);
      }
    }
    if (skipped.length > 0) {
      archive.append(
        `These photos could not be fetched during export:\n${skipped.join("\n")}\n`,
        { name: "skipped.txt" }
      );
    }
    try {
      await archive.finalize();
    } catch (err) {
      console.error("Export zip finalize failed:", err);
      archive.abort();
    }
  })();

  const filename = `bare-root-export-${new Date().toISOString().slice(0, 10)}.zip`;
  return new Response(Readable.toWeb(archive as unknown as Readable) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
