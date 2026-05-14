import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function toTitleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

async function wikiSummary(slug: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`,
      { headers: { "User-Agent": "BareRoot/1.0 (bareroot.garden)" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data.thumbnail?.source as string | undefined) ?? null;
  } catch {
    return null;
  }
}

async function fetchWikipediaImage(name: string): Promise<string | null> {
  const variants = [
    name,
    toTitleCase(name),
    name.charAt(0).toUpperCase() + name.slice(1),
    name.replace(/\s+/g, "_"),
    toTitleCase(name).replace(/\s+/g, "_"),
  ].filter((v, i, a) => a.indexOf(v) === i);

  for (const variant of variants) {
    const url = await wikiSummary(variant.replace(/\s+/g, "_"));
    if (url) return url;
    await new Promise((r) => setTimeout(r, 80));
  }
  return null;
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
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
    orderBy: { name: "asc" },
  });

  const results: { name: string; url: string | null }[] = [];
  let fixed = 0;

  for (const plant of plants) {
    const url = await fetchWikipediaImage(plant.name);
    if (url) {
      await db.plantLibrary.update({ where: { id: plant.id }, data: { imageUrl: url } });
      fixed++;
    }
    results.push({ name: plant.name, url });
  }

  return NextResponse.json({ fixed, remaining: results.length - fixed, results });
}
