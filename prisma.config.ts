import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use direct (non-pooled) URL for migrations; app runtime uses adapter in lib/db.ts
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"]!,
  },
});
