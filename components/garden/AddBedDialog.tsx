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
import { createBed } from "@/app/actions/bed";
import { Plus, Loader2 } from "lucide-react";

export function AddBedDialog({ gardenId, asTile, primary }: { gardenId: string; asTile?: boolean; primary?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    widthFt: "",
    heightFt: "",
    cellSizeIn: "12" as "12" | "6",
  });

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const valid =
    form.name.trim().length > 0 &&
    parseFloat(form.widthFt) > 0 &&
    parseFloat(form.heightFt) > 0;

  function handleSubmit() {
    startTransition(async () => {
      const bedId = await createBed({
        gardenId,
        name: form.name.trim(),
        widthFt: parseFloat(form.widthFt),
        heightFt: parseFloat(form.heightFt),
        cellSizeIn: parseInt(form.cellSizeIn) as 12 | 6,
      });
      setOpen(false);
      router.push(`/garden/${gardenId}/beds/${bedId}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {asTile ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            border: "1.5px dashed #E4E4DC",
            borderRadius: "10px",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#ADADAA",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            fontWeight: 500,
            gap: "6px",
            background: "transparent",
            width: "100%",
            minHeight: "80px",
          }}
        >
          <Plus style={{ width: 14, height: 14 }} />
          Add Bed
        </button>
      ) : (
        <DialogTrigger
          render={
            primary ? (
              <Button
                size="sm"
                className="bg-[#1C3D0A] hover:bg-[#3d6b1e] text-white border-[#1C3D0A]"
              />
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="border-[#E4E4DC] text-[#1C3D0A] hover:bg-[#F4F4EC]"
              />
            )
          }
        >
          <Plus className="w-4 h-4 mr-1" />
          Add bed
        </DialogTrigger>
      )}
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Add a raised bed</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Bed name</Label>
            <Input
              placeholder="Bed 2"
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
                placeholder="4"
                value={form.widthFt}
                onChange={(e) => set("widthFt", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Length (ft)</Label>
              <Input
                type="number"
                min="1"
                placeholder="8"
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
          <Button
            onClick={handleSubmit}
            disabled={!valid || isPending}
            className="w-full bg-[#1C3D0A] hover:bg-[#3d6b1e] text-white"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Add bed"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
