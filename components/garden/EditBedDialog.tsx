"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { updateBed, deleteBed } from "@/app/actions/bed";
import { toast } from "sonner";
import { Pencil, Loader2, Trash2 } from "lucide-react";

type Props = {
  bedId: string;
  gardenId: string;
  initial: {
    name: string;
    widthFt: number;
    heightFt: number;
    cellSizeIn: number;
    plantingCount: number;
  };
};

export function EditBedDialog({ bedId, gardenId, initial }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [form, setForm] = useState({
    name: initial.name,
    widthFt: String(initial.widthFt),
    heightFt: String(initial.heightFt),
    cellSizeIn: String(initial.cellSizeIn) as "12" | "6",
  });

  function set<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const widthFt = parseFloat(form.widthFt);
  const heightFt = parseFloat(form.heightFt);
  const cellSizeIn = parseInt(form.cellSizeIn);
  const valid =
    form.name.trim().length > 0 &&
    Number.isFinite(widthFt) && widthFt > 0 &&
    Number.isFinite(heightFt) && heightFt > 0;

  const dimensionsChanged =
    widthFt !== initial.widthFt ||
    heightFt !== initial.heightFt ||
    cellSizeIn !== initial.cellSizeIn;

  const willResetGrid = dimensionsChanged && initial.plantingCount > 0;

  function handleSave() {
    if (!valid) return;
    startSave(async () => {
      try {
        await updateBed(bedId, {
          name: form.name.trim(),
          widthFt,
          heightFt,
          cellSizeIn: cellSizeIn as 12 | 6,
        });
        toast.success("Bed updated");
        setOpen(false);
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Failed to update bed");
      }
    });
  }

  function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    startDelete(async () => {
      try {
        await deleteBed(bedId);
        toast.success("Bed deleted");
        router.push(`/garden/${gardenId}`);
      } catch (err) {
        console.error(err);
        toast.error("Failed to delete bed");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label="Edit bed"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-[#F4F4EC] hover:bg-[#EAEADE] text-[#6B6B5A] hover:text-[#111109] transition-colors"
          />
        }
      >
        <Pencil className="w-3.5 h-3.5" />
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Edit bed</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Bed name</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Width (ft)</Label>
              <Input
                type="number"
                min="1"
                value={form.widthFt}
                onChange={(e) => set("widthFt", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Length (ft)</Label>
              <Input
                type="number"
                min="1"
                value={form.heightFt}
                onChange={(e) => set("heightFt", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cell size</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["12", "6"] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => set("cellSizeIn", size)}
                  className={`p-2.5 rounded-lg border text-sm text-left transition-colors ${
                    form.cellSizeIn === size
                      ? "border-[#1C3D0A] bg-[#F4F4EC] text-[#1C3D0A]"
                      : "border-[#E4E4DC] text-[#6B6B5A] hover:border-[#7DA84E]"
                  }`}
                >
                  {size === "12" ? "1 ft squares" : "6 in squares"}
                </button>
              ))}
            </div>
          </div>

          {willResetGrid && (
            <div className="p-3 rounded-lg border border-amber-200 bg-[#FFF8E7] text-xs text-[#7A4A0A]">
              <strong>Heads up:</strong> Changing dimensions or cell size will rebuild the grid and remove all {initial.plantingCount} planting{initial.plantingCount === 1 ? "" : "s"} in this bed.
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={!valid || isSaving}
            className="w-full bg-[#1C3D0A] hover:bg-[#3d6b1e] text-white"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save changes"}
          </Button>

          <div className="pt-3 border-t border-[#E4E4DC]">
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
              {deleteConfirm ? "Click again to confirm" : "Delete bed"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
