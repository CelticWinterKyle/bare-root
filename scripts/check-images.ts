import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  const total = await db.plantLibrary.count();
  const withImage = await db.plantLibrary.count({ where: { imageUrl: { not: null } } });
  const withoutImage = total - withImage;
  console.log(`Total plants: ${total}`);
  console.log(`With image:   ${withImage}`);
  console.log(`Without:      ${withoutImage}\n`);

  const seedNoImg = await db.plantLibrary.findMany({
    where: { source: "seed", imageUrl: null },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  console.log(`Seed plants missing images (${seedNoImg.length}):`);
  for (const p of seedNoImg) console.log(`  - ${p.name}`);
  await db.$disconnect();
  await pool.end();
}
main().catch((err) => { console.error(err); process.exit(1); });
