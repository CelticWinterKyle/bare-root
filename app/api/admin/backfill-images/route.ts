import { NextResponse } from "next/server";
import { db } from "@/lib/db";

async function fetchWikipediaImage(name: string): Promise<string | null> {
  try {
    const slug = encodeURIComponent(name.replace(/\s+/g, "_"));
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`,
      { headers: { "User-Agent": "BareRoot/1.0 (bareroot.app)" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data.thumbnail?.source as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const plants = await db.plantLibrary.findMany({
    where: {
      OR: [
        { imageUrl: null },
        { imageUrl: { contains: "upgrade_access" } },
      ],
    },
    select: { id: true, name: true },
  });

  const results: { name: string; url: string | null }[] = [];

  for (const plant of plants) {
    const url = await fetchWikipediaImage(plant.name);
    if (url) {
      await db.plantLibrary.update({
        where: { id: plant.id },
        data: { imageUrl: url },
      });
    }
    results.push({ name: plant.name, url });
    // Avoid hammering Wikipedia
    await new Promise((r) => setTimeout(r, 150));
  }

  return NextResponse.json({ fixed: results.length, results });
}
