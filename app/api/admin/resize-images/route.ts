import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const plants = await db.plantLibrary.findMany({
    where: { imageUrl: { contains: "upload.wikimedia.org" } },
    select: { id: true, name: true, imageUrl: true },
  });

  let updated = 0;
  for (const plant of plants) {
    const newUrl = plant.imageUrl!.replace(/\/\d+px-/, "/800px-");
    if (newUrl !== plant.imageUrl) {
      await db.plantLibrary.update({ where: { id: plant.id }, data: { imageUrl: newUrl } });
      updated++;
    }
  }

  return NextResponse.json({ total: plants.length, updated });
}
