"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateGarden, deleteGarden } from "@/app/actions/garden";
import { lookupLocation } from "@/app/actions/location";
import { toast } from "sonner";
import { Loader2, Trash2, MapPin } from "lucide-react";

type Props = {
  gardenId: string;
  initial: {
    name: string;
    description: string | null;
    widthFt: number;
    heightFt: number;
    locationZip: string | null;
    usdaZone: string | null;
    lastFrostDate: string | null; // "MM-DD"
    firstFrostDate: string | null; // "MM-DD"
  };
};

// MM-DD → 2000-MM-DD (for date input)
function mmddToInput(mmdd: string | null): string {
  if (!mmdd) return "";
  return `2000-${mmdd}`;
}

// 2000-MM-DD (or any YYYY-MM-DD) → MM-DD
function inputToMmdd(value: string): string | null {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  return `${parts[1]}-${parts[2]}`;
}

function formatMmdd(mmdd: string | null): string {
  if (!mmdd) return "—";
  const [m, d] = mmdd.split("-").map(Number);
  return new Date(2000, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function GardenSettingsForm({ gardenId, initial }: Props) {
  const [form, setForm] = useState({
    name: initial.name,
    description: initial.description ?? "",
    widthFt: String(initial.widthFt),
    heightFt: String(initial.heightFt),
    locationZip: initial.locationZip ?? "",
    lastFrostDate: mmddToInput(initial.lastFrostDate),
    firstFrostDate: mmddToInput(initial.firstFrostDate),
  });
  const [zone, setZone] = useState<string | null>(initial.usdaZone);
  const [isSaving, startSave] = useTransition();
  const [isLookingUp, startLookup] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  function set<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleZipLookup() {
    const zip = form.locationZip.trim();
    if (!zip) {
      toast.error("Enter a zip code first");
      return;
    }
    startLookup(async () => {
      const result = await lookupLocation(zip);
      if (!result) {
        toast.error("Couldn't find zone data for that zip. You can still enter frost dates manually.");
        setZone(null);
        return;
      }
      setZone(result.zone);
      setForm((prev) => ({
        ...prev,
        lastFrostDate: result.lastFrostDate ? mmddToInput(result.lastFrostDate) : prev.lastFrostDate,
        firstFrostDate: result.firstFrostDate ? mmddToInput(result.firstFrostDate) : prev.firstFrostDate,
      }));
      toast.success(`Zone ${result.zone} found`);
    });
  }

  function handleSave() {
    const widthFt = parseFloat(form.widthFt);
    const heightFt = parseFloat(form.heightFt);
    if (!form.name.trim()) {
      toast.error("Garden name is required");
      return;
    }
    if (!Number.isFinite(widthFt) || widthFt <= 0 || !Number.isFinite(heightFt) || heightFt <= 0) {
      toast.error("Width and length must be greater than 0");
      return;
    }

    startSave(async () => {
      try {
        await updateGarden(gardenId, {
          name: form.name.trim(),
          description: form.description.trim() || null,
          widthFt,
          heightFt,
          locationZip: form.locationZip.trim() || null,
          lastFrostDate: inputToMmdd(form.lastFrostDate),
          firstFrostDate: inputToMmdd(form.firstFrostDate),
        });
        toast.success("Garden updated");
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 4000);
      return;
    }
    startDelete(async () => {
      try {
        await deleteGarden(gardenId);
      } catch (err) {
        // deleteGarden redirects on success; only catches actual failures
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) return;
        console.error(err);
        toast.error("Failed to delete garden");
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* General */}
      <section>
        <h2 className="font-medium text-[#111109] mb-3">General</h2>
        <div className="space-y-3 bg-white border border-[#E4E4DC] rounded-xl p-4">
          <div className="space-y-1.5">
            <Label>Garden name</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Input
              placeholder="A note about this garden"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Width (ft)</Label>
              <Input
                type="number"
                min="1"
                value={form.widthFt}
                onChange={(e) => set("widthFt", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Length (ft)</Label>
              <Input
                type="number"
                min="1"
                value={form.heightFt}
                onChange={(e) => set("heightFt", e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Location */}
      <section>
        <h2 className="font-medium text-[#111109] mb-3">Location & climate</h2>
        <div className="space-y-3 bg-white border border-[#E4E4DC] rounded-xl p-4">
          <div className="space-y-1.5">
            <Label>Zip code</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. 45213"
                value={form.locationZip}
                onChange={(e) => set("locationZip", e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleZipLookup}
                disabled={isLookingUp || !form.locationZip.trim()}
                variant="outline"
                className="border-[#E4E4DC] text-[#1C3D0A] hover:bg-[#F4F4EC]"
              >
                {isLookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <><MapPin className="w-3.5 h-3.5 mr-1" />Look up</>}
              </Button>
            </div>
            {zone && (
              <p className="text-xs text-[#3A6B20] font-medium">USDA Zone {zone}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Last frost</Label>
              <Input
                type="date"
                value={form.lastFrostDate}
                onChange={(e) => set("lastFrostDate", e.target.value)}
              />
              <p className="text-[10px] text-[#ADADAA]">{formatMmdd(inputToMmdd(form.lastFrostDate))} (year ignored)</p>
            </div>
            <div className="space-y-1.5">
              <Label>First frost</Label>
              <Input
                type="date"
                value={form.firstFrostDate}
                onChange={(e) => set("firstFrostDate", e.target.value)}
              />
              <p className="text-[10px] text-[#ADADAA]">{formatMmdd(inputToMmdd(form.firstFrostDate))} (year ignored)</p>
            </div>
          </div>
        </div>
      </section>

      <Button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full bg-[#1C3D0A] hover:bg-[#3d6b1e] text-white"
      >
        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save changes"}
      </Button>

      {/* Danger zone */}
      <section className="pt-4 border-t border-[#E4E4DC]">
        <h2 className="font-medium text-[#7A2A18] mb-2">Danger zone</h2>
        <p className="text-xs text-[#6B6B5A] mb-3">
          Deleting this garden removes all beds, plantings, seasons, photos, and notes. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className={`w-full py-2 rounded-lg text-sm font-medium transition-colors border ${
            deleteConfirm
              ? "bg-[#7A2A18] text-white border-[#7A2A18]"
              : "bg-transparent text-[#7A2A18] border-[rgba(122,42,24,0.2)] hover:bg-[#FBF0EE]"
          } disabled:opacity-50 flex items-center justify-center gap-2`}
        >
          {isDeleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          {deleteConfirm ? "Click again to confirm permanent delete" : "Delete garden"}
        </button>
      </section>
    </div>
  );
}
