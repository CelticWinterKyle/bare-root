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
    take: 5,
  });

  return NextResponse.json({ sample: plants.map((p) => ({ name: p.name, url: p.imageUrl })) });
}
