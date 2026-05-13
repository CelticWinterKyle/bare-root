"use client";
import { useState, useTransition } from "react";
import { addHarvestLog, deleteHarvestLog } from "@/app/actions/tracking";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const UNITS = ["lbs", "oz", "kg", "g", "count", "bunches", "bags"];

type Log = {
  id: string;
  quantity: number;
  unit: string;
  notes: string | null;
  harvestedAt: Date;
};

type Props = {
  plantingId: string;
  logs: Log[];
};

export function HarvestLogSection({ plantingId, logs }: Props) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("lbs");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [isAdding, startAdd] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startDelete] = useTransition();

  const total = logs.reduce((s, l) => s + l.quantity, 0);
  const unit0 = logs[0]?.unit ?? unit;

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!quantity || Number(quantity) <= 0) return;
    startAdd(async () => {
      await addHarvestLog(plantingId, { quantity: Number(quantity), unit, notes: notes || undefined, harvestedAt: date });
      setQuantity("");
      setNotes("");
      setOpen(false);
    });
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    startDelete(async () => {
      await deleteHarvestLog(id);
      setDeletingId(null);
    });
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg font-semibold text-[#111109]">Harvest log</h2>
        {logs.length > 0 && (
          <span className="text-sm text-[#D4820A] font-medium">{total} {unit0} total</span>
        )}
      </div>

      {logs.length > 0 && (
        <div className="space-y-2 mb-3">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between p-3 bg-[#FFF3E8] border border-orange-100 rounded-xl">
              <div>
                <span className="text-sm font-medium text-[#111109]">
                  {log.quantity} {log.unit}
                </span>
                <span className="text-xs text-[#ADADAA] ml-2">
                  {new Date(log.harvestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                {log.notes && <p className="text-xs text-[#6B6B5A] mt-0.5">{log.notes}</p>}
              </div>
              <button
                onClick={() => handleDelete(log.id)}
                disabled={deletingId === log.id}
                className="text-[#ADADAA] hover:text-[#B85C3A] transition-colors ml-3"
              >
                {deletingId === log.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {open ? (
        <form onSubmit={handleAdd} className="bg-white border border-[#E4E4DC] rounded-xl p-4 space-y-3">
          <div className="flex gap-2">
            <Input
              type="number"
              min="0"
              step="0.1"
              placeholder="Amount"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              autoFocus
              className="flex-1"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="border border-[#E4E4DC] rounded-md px-3 py-2 text-sm text-[#111109] bg-white focus:outline-none focus:ring-1 focus:ring-[#1C3D0A]"
            >
              {UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Input
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={isAdding} className="bg-[#D4820A] hover:bg-[#A0650A] text-white">
              {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log harvest"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-sm text-[#D4820A] hover:text-[#A0650A] font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Log harvest
        </button>
      )}
    </section>
  );
}
