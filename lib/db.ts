import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Use Neon's own serverless driver instead of node-postgres (pg) over the
// pooler. The pg/TCP path to Neon's pooler endpoint occasionally handed a
// serverless request a bad/recycled connection, surfacing as intermittent
// `Invalid \`prisma...\`` 500s that a retry would clear. The Neon serverless
// driver is built for exactly this — pooled, short-lived serverless
// connections — and is the setup Prisma + Neon recommend on Vercel.
//
// Interactive transactions (db.$transaction) run over a WebSocket, which needs
// a WebSocket implementation in Node. Node 22+ ships a global one, but set the
// `ws` polyfill explicitly so it works on every runtime version.
neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
