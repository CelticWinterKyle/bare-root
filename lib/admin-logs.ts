import "server-only";
import { db } from "@/lib/db";

/**
 * Per-million-token prices in cents, by model. Used at write time so the
 * logged cost is what the run cost when it ran, not what the model costs
 * today. Update when a model's price changes; unknown models log 0.
 */
const PRICE_CENTS_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 200, output: 1000 },
  "claude-opus-5": { input: 500, output: 2500 },
  "claude-opus-4-8": { input: 500, output: 2500 },
  "claude-haiku-4-5": { input: 100, output: 500 },
};

export function costCents(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICE_CENTS_PER_MTOK[model];
  if (!p) return 0;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export async function recordAiRun(row: {
  userId: string;
  bedId?: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  plantsAsked: number;
  plantsPlaced: number;
  ok: boolean;
  error?: string | null;
  durationMs: number;
}): Promise<void> {
  try {
    await db.aiRun.create({
      data: { ...row, bedId: row.bedId ?? null, error: row.error ?? null, costCents: costCents(row.model, row.inputTokens, row.outputTokens) },
    });
  } catch (err) {
    // Logging must never break the feature it logs.
    console.error("recordAiRun failed:", err);
  }
}

/**
 * Wraps a cron handler: writes a CronRun row when it starts, fills in the
 * counters and outcome when it finishes. `run` returns the counters it
 * wants recorded; the wrapper never swallows the handler's own errors.
 */
export async function withCronRun<T extends { sent?: number; held?: number; failed?: number }>(
  name: string,
  run: () => Promise<T>
): Promise<T> {
  let id: string | null = null;
  try {
    id = (await db.cronRun.create({ data: { name }, select: { id: true } })).id;
  } catch (err) {
    console.error("cronRun start failed:", err);
  }
  try {
    const result = await run();
    if (id) {
      await db.cronRun
        .update({
          where: { id },
          data: { finishedAt: new Date(), ok: true, sent: result.sent ?? 0, held: result.held ?? 0, failed: result.failed ?? 0 },
        })
        .catch((err) => console.error("cronRun finish failed:", err));
    }
    return result;
  } catch (err) {
    if (id) {
      await db.cronRun
        .update({ where: { id }, data: { finishedAt: new Date(), ok: false, error: err instanceof Error ? err.message.slice(0, 500) : String(err) } })
        .catch(() => {});
    }
    throw err;
  }
}
