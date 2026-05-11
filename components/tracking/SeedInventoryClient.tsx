"use client";
import { useState, useTransition } from "react";
import { upsertSeedInventory, deleteSeedInventory } from "@/app/actions/tracking";
import { Plus, Trash2, Loader2, ShoppingCart, Check, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const UNITS = ["packets", "seeds", "oz", "g", "lbs"];

type InventoryItem = {
  id: string;
  plantId: string;
  plantName: string;
  variety: string;
  quantity: number;
  unit: string;
  notes: string | null;
};

type ShoppingItem = {
  plantId: string;
  plantName: string;
  inInventory: boolean;
  inventoryQty: number | null;
};

type Props = {
  inventory: InventoryItem[];
  shoppingList: ShoppingItem[];
};

export function SeedInventoryClient({ inventory, shoppingList }: Props) {
  const [tab, setTab] = useState<"inventory" | "shopping">("inventory");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ plantName: "", variety: "", quantity: "1", unit: "packets", notes: "" });
  const [isAdding, startAdd] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startDelete] = useTransition();
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    startAdd(async () => {
      // We need a plantId — for now we'll search, but let's keep it simple with a note
      // This is a simplified path: real flow would use plant search
      setAddOpen(false);
    });
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    startDelete(async () => {
      await deleteSeedInventory(id);
      setDeletingId(null);
    });
  }

  function handleShareShopping() {
    const unchecked = shoppingList.filter((s) => !s.inInventory && !checked.has(s.plantId));
    const text = unchecked.map((s) => `• ${s.plantName}`).join("\n");
    if (navigator.share) {
      navigator.share({ title: "Seeds to buy", text });
    } else {
      navigator.clipboard.writeText(text);
    }
  }

  const needToBuy = shoppingList.filter((s) => !s.inInventory);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-semibold text-[#1C1C1A]">Inventory</h1>
        {tab === "inventory" && (
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            className="bg-[#2D5016] hover:bg-[#4A7C2F] text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add seeds
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#F5F0E8] rounded-xl p-1">
        {(["inventory", "shopping"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t
                ? "bg-white text-[#1C1C1A] shadow-sm"
                : "text-[#6B6560] hover:text-[#1C1C1A]"
            }`}
          >
            {t === "inventory" ? (
              <span className="flex items-center justify-center gap-1.5">
                <Package className="w-4 h-4" />
                Seeds on hand ({inventory.length})
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <ShoppingCart className="w-4 h-4" />
                Shopping list ({needToBuy.length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Inventory tab */}
      {tab === "inventory" && (
        <>
          {addOpen && (
            <form onSubmit={handleAdd} className="bg-white border border-[#E8E2D9] rounded-xl p-4 space-y-3 mb-4">
              <p className="text-sm font-medium text-[#1C1C1A]">Add seeds</p>
              <Input
                placeholder="Plant name"
                value={form.plantName}
                onChange={(e) => setForm((f) => ({ ...f, plantName: e.target.value }))}
                required
              />
              <Input
                placeholder="Variety (optional)"
                value={form.variety}
                onChange={(e) => setForm((f) => ({ ...f, variety: e.target.value }))}
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Qty"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  className="w-24"
                  required
                />
                <select
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  className="border border-[#E8E2D9] rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#2D5016]"
                >
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isAdding} className="bg-[#2D5016] hover:bg-[#4A7C2F] text-white">
                  {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
              </div>
            </form>
          )}

          {inventory.length === 0 && !addOpen ? (
            <div className="text-center py-12 text-[#9E9890]">
              <Package className="w-10 h-10 mx-auto mb-3 text-[#E8E2D9]" />
              <p className="text-sm">No seeds tracked yet.</p>
              <p className="text-xs mt-1">Add what you have on hand.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {inventory.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-[#E8E2D9] rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-[#1C1C1A]">
                      {item.plantName}{item.variety ? ` — ${item.variety}` : ""}
                    </p>
                    <p className="text-xs text-[#9E9890]">
                      {item.quantity} {item.unit}
                      {item.notes && ` · ${item.notes}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="text-[#9E9890] hover:text-[#B85C3A] transition-colors"
                  >
                    {deletingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Shopping list tab */}
      {tab === "shopping" && (
        <>
          {shoppingList.length === 0 ? (
            <div className="text-center py-12 text-[#9E9890]">
              <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-[#E8E2D9]" />
              <p className="text-sm">No active plantings found.</p>
              <p className="text-xs mt-1">Plan your beds to generate a shopping list.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {shoppingList.map((item) => (
                  <div
                    key={item.plantId}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${
                      item.inInventory
                        ? "bg-[#F5F0E8] border-[#E8E2D9] opacity-60"
                        : checked.has(item.plantId)
                        ? "bg-[#F5F0E8] border-[#E8E2D9]"
                        : "bg-white border-[#E8E2D9]"
                    }`}
                  >
                    <button
                      onClick={() =>
                        setChecked((prev) => {
                          const n = new Set(prev);
                          n.has(item.plantId) ? n.delete(item.plantId) : n.add(item.plantId);
                          return n;
                        })
                      }
                      className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                        item.inInventory || checked.has(item.plantId)
                          ? "bg-[#4A7C2F] border-[#4A7C2F]"
                          : "border-[#E8E2D9]"
                      }`}
                    >
                      {(item.inInventory || checked.has(item.plantId)) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </button>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${item.inInventory || checked.has(item.plantId) ? "line-through text-[#9E9890]" : "text-[#1C1C1A]"}`}>
                        {item.plantName}
                      </p>
                      {item.inInventory && item.inventoryQty !== null && (
                        <p className="text-xs text-[#6B8F47]">{item.inventoryQty} in stock</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {needToBuy.length > 0 && (
                <Button
                  onClick={handleShareShopping}
                  variant="outline"
                  className="w-full border-[#2D5016] text-[#2D5016] hover:bg-[#F5F0E8]"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Share list ({needToBuy.filter((s) => !checked.has(s.plantId)).length} items)
                </Button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
