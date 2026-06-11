"use client";

import { useEffect, useMemo, useState } from "react";
import { CloudOff, RefreshCw, Check } from "lucide-react";
import {
  getSnapshot,
  queueHarvest,
  listQueuedHarvests,
  type OfflineSnapshot,
  type QueuedHarvest,
} from "@/lib/offline/db";

// Matches the canvas's category palette so offline beds read the same.
const CATEGORY_COLOR: Record<string, string> = {
  VEGETABLE: "#4a8a2e",
  FRUIT: "#C44A2A",
  HERB: "#7DA84E",
  FLOWER: "#BC6B8A",
  TREE: "#3d6b32",
  SHRUB: "#5A8240",
  OTHER: "#A07640",
};

const UNITS = ["lbs", "oz", "kg", "g", "count", "bunches", "bags"];

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Read-only offline garden: renders beds + plantings from the IndexedDB
 * snapshot and queues harvest logs for sync. Deliberately simple CSS-grid
 * rendering (not BedGrid) — no interactivity beyond harvest logging.
 */
export function OfflineClient() {
  const [snapshot, setSnapshotState] = useState<OfflineSnapshot | null>(null);
  const [queued, setQueued] = useState<QueuedHarvest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [logFor, setLogFor] = useState<{ id: string; plantName: string } | null>(null);
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("lbs");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    Promise.all([getSnapshot(), listQueuedHarvests()]).then(([snap, q]) => {
      setSnapshotState(snap);
      setQueued(q);
      setLoaded(true);
    });
  }, []);

  const beds = useMemo(
    () => snapshot?.gardens.flatMap((g) => g.beds.map((b) => ({ ...b, gardenName: g.name }))) ?? [],
    [snapshot]
  );

  async function handleLog() {
    if (!logFor) return;
    const quantity = parseFloat(qty);
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    const entry: QueuedHarvest = {
      clientId: crypto.randomUUID(),
      plantingId: logFor.id,
      plantName: logFor.plantName,
      quantity,
      unit,
      harvestedAt: todayYmd(),
      queuedAt: new Date().toISOString(),
    };
    await queueHarvest(entry);
    setQueued((prev) => [...prev, entry]);
    setLogFor(null);
    setQty("");
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
    // If we're actually online (user just visited /offline directly), let
    // the sync plumbing pick it up immediately.
    window.dispatchEvent(new Event("online"));
  }

  return (
    <div className="container-narrow px-[22px] md:px-8 py-8">
      <div className="flex items-center gap-3 mb-1">
        <CloudOff className="w-5 h-5" style={{ color: "#7DA84E" }} />
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 24,
            fontWeight: 800,
            color: "#111109",
            letterSpacing: "-0.025em",
          }}
        >
          Offline <em style={{ fontStyle: "italic", color: "#1C3D0A" }}>garden</em>
        </h1>
      </div>
      <p className="text-sm mb-1" style={{ color: "#6B6B5A" }}>
        A saved copy of your beds{snapshot ? ` from ${new Date(snapshot.generatedAt).toLocaleString()}` : ""}.
        Harvests you log here sync when you&apos;re back online.
      </p>
      {queued.length > 0 && (
        <p className="text-xs mb-4 flex items-center gap-1.5" style={{ color: "#D4820A" }}>
          <RefreshCw className="w-3 h-3" />
          {queued.length} harvest{queued.length === 1 ? "" : "s"} waiting to sync
        </p>
      )}
      {savedFlash && (
        <p className="text-xs mb-4 flex items-center gap-1.5" style={{ color: "#1C3D0A" }}>
          <Check className="w-3 h-3" /> Saved on this device — will sync when online
        </p>
      )}

      {!loaded ? null : beds.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm font-medium" style={{ color: "#111109" }}>
            No saved garden yet
          </p>
          <p className="text-xs mt-1" style={{ color: "#6B6B5A" }}>
            Open the app once while online and your beds will be available here.
          </p>
        </div>
      ) : (
        <div className="space-y-8 mt-6">
          {beds.map((bed) => (
            <div key={bed.id}>
              <p className="text-sm font-semibold mb-0.5" style={{ color: "#111109", fontFamily: "var(--font-display)" }}>
                {bed.name}
                <span className="font-normal text-xs ml-2" style={{ color: "#6B6B5A" }}>
                  {bed.gardenName} · {bed.gridCols}×{bed.gridRows}
                </span>
              </p>
              <div
                className="grid gap-[2px] p-2 rounded-xl overflow-x-auto"
                style={{
                  background: "#3a2818",
                  gridTemplateColumns: `repeat(${bed.gridCols}, minmax(18px, 36px))`,
                  maxWidth: "100%",
                  width: "fit-content",
                }}
              >
                {Array.from({ length: bed.gridRows * bed.gridCols }, (_, i) => {
                  const row = Math.floor(i / bed.gridCols);
                  const col = i % bed.gridCols;
                  const planting = bed.plantings.find((p) =>
                    p.cells.some((c) => c.row === row && c.col === col)
                  );
                  return (
                    <div
                      key={i}
                      className="aspect-square rounded-[3px]"
                      style={{
                        background: planting
                          ? CATEGORY_COLOR[planting.category] ?? CATEGORY_COLOR.OTHER
                          : "rgba(253,253,248,0.25)",
                      }}
                      title={planting ? planting.plantName : undefined}
                    />
                  );
                })}
              </div>
              {/* Plant list + harvest logging */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {bed.plantings.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setLogFor({ id: p.id, plantName: p.plantName })}
                    className="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                    style={{
                      border: "1.5px solid #E4E4DC",
                      background: logFor?.id === p.id ? "#1C3D0A" : "#F4F4EC",
                      color: logFor?.id === p.id ? "white" : "#3A3A30",
                    }}
                  >
                    {p.plantName}
                    {p.variety ? ` · ${p.variety}` : ""}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Harvest log mini-form */}
      {logFor && (
        <div
          className="fixed bottom-0 left-0 right-0 p-4 flex items-center gap-2 justify-center"
          style={{ background: "#FDFDF8", borderTop: "1px solid #E4E4DC" }}
        >
          <span className="text-sm font-medium" style={{ color: "#111109" }}>
            {logFor.plantName}:
          </span>
          <input
            type="number"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="Qty"
            className="w-20 rounded-lg px-2 py-1.5 text-sm"
            style={{ background: "#F4F4EC", border: "1px solid #E4E4DC" }}
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="rounded-lg px-2 py-1.5 text-sm"
            style={{ background: "#F4F4EC", border: "1px solid #E4E4DC" }}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleLog}
            disabled={!qty}
            className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "#1C3D0A" }}
          >
            Log
          </button>
          <button
            type="button"
            onClick={() => setLogFor(null)}
            className="text-sm px-2"
            style={{ color: "#6B6B5A" }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
