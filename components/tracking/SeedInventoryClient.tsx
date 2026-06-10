"use client";
import { useState, useTransition } from "react";
import { upsertSeedInventory, deleteSeedInventory } from "@/app/actions/tracking";
import { searchPlantsAction } from "@/app/actions/plants";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, ShoppingCart, Check, Package, Search, X } from "lucide-react";
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
  variety: string;
  inInventory: boolean;
  inventoryQty: number | null;
};

// plantId is a cuid (no spaces), so this composite key is unambiguous.
const itemKey = (i: Pick<ShoppingItem, "plantId" | "variety">) => `${i.plantId} ${i.variety}`;
const itemLabel = (i: Pick<ShoppingItem, "plantName" | "variety">) =>
  i.variety ? `${i.plantName} · ${i.variety}` : i.plantName;

type PlantResult = { id: string; name: string };

type Props = {
  userId: string;
  inventory: InventoryItem[];
  shoppingList: ShoppingItem[];
};

export function SeedInventoryClient({ userId, inventory, shoppingList }: Props) {
  const [tab, setTab] = useState<"inventory" | "shopping">("inventory");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ variety: "", quantity: "1", unit: "packets", notes: "" });
  const [plantQuery, setPlantQuery] = useState("");
  const [plantResults, setPlantResults] = useState<PlantResult[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<PlantResult | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [isAdding, startAdd] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startDelete] = useTransition();
  // Optimistic check-offs, keyed by plantId+variety. Checking creates the
  // SeedInventory row server-side, so after revalidation the item reads as
  // in-stock without this local state.
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [, startBuy] = useTransition();

  function handlePlantSearch(q: string) {
    setPlantQuery(q);
    setSelectedPlant(null);
    if (q.trim().length < 2) {
      setPlantResults([]);
      return;
    }
    startSearch(async () => {
      const results = await searchPlantsAction(q, null, userId);
      setPlantResults(results.slice(0, 8).map((p) => ({ id: p.id, name: p.name })));
    });
  }

  function resetForm() {
    setForm({ variety: "", quantity: "1", unit: "packets", notes: "" });
    setPlantQuery("");
    setPlantResults([]);
    setSelectedPlant(null);
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlant) {
      toast.error("Please select a plant from the search results");
      return;
    }
    const qty = parseFloat(form.quantity);
    if (!Number.isFinite(qty) || qty < 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    startAdd(async () => {
      try {
        await upsertSeedInventory({
          plantId: selectedPlant.id,
          variety: form.variety.trim(),
          quantity: qty,
          unit: form.unit,
          notes: form.notes.trim() || undefined,
        });
        toast.success(`${selectedPlant.name} added to inventory`);
        resetForm();
        setAddOpen(false);
      } catch (err) {
        console.error(err);
        toast.error("Failed to save. Please try again.");
      }
    });
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    startDelete(async () => {
      await deleteSeedInventory(id);
      setDeletingId(null);
    });
  }

  function uncheck(key: string) {
    setChecked((prev) => {
      const n = new Set(prev);
      n.delete(key);
      return n;
    });
  }

  // Checking a shopping item = "bought it": create the inventory row
  // (1 packet) so the item is owned on the next render. Optimistic
  // strikethrough, with Undo in the toast deleting the created row.
  function handleBuy(item: ShoppingItem) {
    const key = itemKey(item);
    if (item.inInventory || checked.has(key)) return;
    setChecked((prev) => new Set(prev).add(key));
    startBuy(async () => {
      try {
        const { id } = await upsertSeedInventory({
          plantId: item.plantId,
          variety: item.variety,
          quantity: 1,
          unit: "packets",
        });
        toast.success(`Added to your seeds — ${itemLabel(item)}`, {
          action: {
            label: "Undo",
            onClick: () => {
              deleteSeedInventory(id)
                .then(() => uncheck(key))
                .catch((err) => {
                  console.error(err);
                  toast.error("Couldn't undo. Remove it under Seeds on hand instead.");
                });
            },
          },
        });
      } catch (err) {
        console.error(err);
        uncheck(key);
        toast.error("Couldn't add to your seeds. Please try again.");
      }
    });
  }

  function handleShareShopping() {
    const unchecked = shoppingList.filter((s) => !s.inInventory && !checked.has(itemKey(s)));
    if (unchecked.length === 0) {
      toast.info("Nothing to share — your shopping list is empty.");
      return;
    }
    const text = unchecked.map((s) => `• ${itemLabel(s)}`).join("\n");
    if (navigator.share) {
      navigator.share({ title: "Seeds to buy", text }).catch(() => {});
    } else {
      navigator.clipboard
        .writeText(text)
        .then(() => toast.success("Shopping list copied to clipboard"))
        .catch(() => toast.error("Couldn't copy the list. Please try again."));
    }
  }

  const needToBuy = shoppingList.filter((s) => !s.inInventory);

  return (
    <div>
      {/* Page header */}
      <div className="px-[22px] md:px-8 pt-6 pb-5" style={{ borderBottom: "1px solid #E4E4DC" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#7DA84E", marginBottom: "6px" }}>
              <span style={{ display: "block", width: "16px", height: "1.5px", background: "#7DA84E", borderRadius: "1px", flexShrink: 0 }} />
              Tracking
            </div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 4vw, 30px)", fontWeight: 800, color: "#111109", letterSpacing: "-0.03em", lineHeight: 1, fontVariationSettings: "'opsz' 32" }}>
              Inventory
            </h1>
          </div>
          {tab === "inventory" && (
            <Button
              size="sm"
              onClick={() => setAddOpen(true)}
              className="bg-[#1C3D0A] hover:bg-[#3A6B20] text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add seeds
            </Button>
          )}
        </div>
      </div>
      <div className="px-[22px] md:px-8 py-5">

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#F4F4EC] rounded-xl p-1">
        {(["inventory", "shopping"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t
                ? "bg-white text-[#111109] shadow-sm"
                : "text-[#6B6B5A] hover:text-[#111109]"
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
            <form onSubmit={handleAdd} className="bg-white border border-[#E4E4DC] rounded-xl p-4 space-y-3 mb-4">
              <p className="text-sm font-medium text-[#111109]">Add seeds</p>

              {/* Plant search */}
              {selectedPlant ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-[#E4F0D4] border border-[#D4E8BE]">
                  <span className="text-sm font-medium text-[#1C3D0A]">{selectedPlant.name}</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedPlant(null); setPlantQuery(""); }}
                    className="text-[#3A6B20] hover:text-[#1C3D0A]"
                    aria-label="Clear selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADADAA]" />
                  <Input
                    placeholder="Search plants…"
                    value={plantQuery}
                    onChange={(e) => handlePlantSearch(e.target.value)}
                    className="pl-9"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#ADADAA]" />
                  )}
                  {plantResults.length > 0 && (
                    <ul className="mt-1 max-h-48 overflow-y-auto border border-[#E4E4DC] rounded-md bg-white shadow-sm">
                      {plantResults.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => { setSelectedPlant(p); setPlantQuery(p.name); setPlantResults([]); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-[#F4F4EC] text-[#111109]"
                          >
                            {p.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {plantQuery.length >= 2 && !isSearching && plantResults.length === 0 && (
                    <p className="text-xs text-[#ADADAA] mt-1">No plants found. Try a different search.</p>
                  )}
                </div>
              )}

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
                  className="border border-[#E4E4DC] rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1C3D0A]"
                >
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <Input
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isAdding || !selectedPlant}
                  className="bg-[#1C3D0A] hover:bg-[#3A6B20] text-white"
                >
                  {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => { resetForm(); setAddOpen(false); }}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {inventory.length === 0 && !addOpen ? (
            <div className="text-center py-12 text-[#ADADAA]">
              <Package className="w-10 h-10 mx-auto mb-3 text-[#E4E4DC]" />
              <p className="text-sm">No seeds tracked yet.</p>
              <p className="text-xs mt-1">Add what you have on hand.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {inventory.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-[#E4E4DC] rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-[#111109]">
                      {item.plantName}{item.variety ? ` · ${item.variety}` : ""}
                    </p>
                    <p className="text-xs text-[#ADADAA]">
                      {item.quantity} {item.unit}
                      {item.notes && ` · ${item.notes}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="text-[#ADADAA] hover:text-[#B85C3A] transition-colors"
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
            <div className="text-center py-12 text-[#ADADAA]">
              <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-[#E4E4DC]" />
              <p className="text-sm">No active plantings found.</p>
              <p className="text-xs mt-1">Plan your beds to generate a shopping list.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                {shoppingList.map((item) => {
                  const isChecked = item.inInventory || checked.has(itemKey(item));
                  return (
                    <div
                      key={itemKey(item)}
                      className={`flex items-center gap-3 p-3 rounded-xl border ${
                        item.inInventory
                          ? "bg-[#F4F4EC] border-[#E4E4DC] opacity-60"
                          : isChecked
                          ? "bg-[#F4F4EC] border-[#E4E4DC]"
                          : "bg-white border-[#E4E4DC]"
                      }`}
                    >
                      <button
                        onClick={() => handleBuy(item)}
                        disabled={isChecked}
                        aria-label={`Mark ${itemLabel(item)} as bought`}
                        className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                          isChecked ? "bg-[#3A6B20] border-[#3A6B20]" : "border-[#E4E4DC]"
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${isChecked ? "line-through text-[#ADADAA]" : "text-[#111109]"}`}>
                          {itemLabel(item)}
                        </p>
                        {item.inInventory && item.inventoryQty !== null && (
                          <p className="text-xs text-[#7DA84E]">{item.inventoryQty} in stock</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {needToBuy.length > 0 && (
                <Button
                  onClick={handleShareShopping}
                  variant="outline"
                  className="w-full border-[#1C3D0A] text-[#1C3D0A] hover:bg-[#F4F4EC]"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Share list ({needToBuy.filter((s) => !checked.has(itemKey(s))).length} items)
                </Button>
              )}
            </>
          )}
        </>
      )}
      </div>
    </div>
  );
}
