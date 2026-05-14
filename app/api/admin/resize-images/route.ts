import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const plants = await db.plantLibrary.findMany({
    where: { imageUrl: { contains: "upload.wikimedia.org" } },
    select: { id: true, name: true, imageUrl: true },
    take: 5,
  });

  return NextResponse.json({ sample: plants.map((p) => ({ name: p.name, url: p.imageUrl })) });
}
