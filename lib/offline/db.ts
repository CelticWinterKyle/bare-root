"use client";

/**
 * Hand-rolled IndexedDB helpers for offline support — no dependencies.
 * Two stores: `snapshot` (single "latest" record of the user's beds) and
 * `harvestQueue` (pending harvest logs keyed by clientId, replayed by
 * OfflineSync when the connection returns).
 */

const DB_NAME = "bareroot-offline";
const DB_VERSION = 1;

export type OfflineSnapshot = {
  generatedAt: string;
  gardens: {
    id: string;
    name: string;
    beds: {
      id: string;
      name: string;
      gridCols: number;
      gridRows: number;
      cellSizeIn: number;
      plantings: {
        id: string;
        plantName: string;
        category: string;
        variety: string | null;
        status: string;
        quantityPerCell: number;
        anchor: { row: number; col: number } | null;
        cells: { row: number; col: number }[];
      }[];
    }[];
  }[];
};

export type QueuedHarvest = {
  clientId: string;
  plantingId: string;
  plantName: string;
  quantity: number;
  unit: string;
  notes?: string;
  harvestedAt: string; // YYYY-MM-DD
  queuedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("snapshot")) db.createObjectStore("snapshot");
      if (!db.objectStoreNames.contains("harvestQueue")) {
        db.createObjectStore("harvestQueue", { keyPath: "clientId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  store: "snapshot" | "harvestQueue",
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      })
  );
}

export async function getSnapshot(): Promise<OfflineSnapshot | null> {
  try {
    return (await tx("snapshot", "readonly", (s) => s.get("latest"))) ?? null;
  } catch {
    return null;
  }
}

export async function setSnapshot(snapshot: OfflineSnapshot): Promise<void> {
  await tx("snapshot", "readwrite", (s) => s.put(snapshot, "latest"));
}

export async function queueHarvest(entry: QueuedHarvest): Promise<void> {
  await tx("harvestQueue", "readwrite", (s) => s.put(entry));
}

export async function listQueuedHarvests(): Promise<QueuedHarvest[]> {
  try {
    return (await tx("harvestQueue", "readonly", (s) => s.getAll())) ?? [];
  } catch {
    return [];
  }
}

export async function removeQueuedHarvest(clientId: string): Promise<void> {
  await tx("harvestQueue", "readwrite", (s) => s.delete(clientId));
}
