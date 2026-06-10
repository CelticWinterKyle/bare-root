"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCustomPlant } from "@/app/actions/plants";
import type { PlantCategory, SunLevel, WaterNeed } from "@/lib/generated/prisma/enums";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_ITEMS: { value: PlantCategory; label: string }[] = [
  { value: "VEGETABLE", label: "Vegetable" },
  { value: "FRUIT", label: "Fruit" },
  { value: "HERB", label: "Herb" },
  { value: "FLOWER", label: "Flower" },
  { value: "TREE", label: "Tree" },
  { value: "SHRUB", label: "Shrub" },
  { value: "OTHER", label: "Other" },
];

const SUN_ITEMS: { value: SunLevel; label: string }[] = [
  { value: "FULL_SUN", label: "Full sun" },
  { value: "PARTIAL_SUN", label: "Part sun" },
  { value: "PARTIAL_SHADE", label: "Part shade" },
  { value: "FULL_SHADE", label: "Full shade" },
];

const WATER_ITEMS: { value: WaterNeed; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MODERATE", label: "Moderate" },
  { value: "HIGH", label: "High" },
];

const EMPTY_FORM = {
  name: "",
  category: null as PlantCategory | null,
  daysToMaturity: "",
  spacingInches: "",
  sunRequirement: null as SunLevel | null,
  waterRequirement: null as WaterNeed | null,
  description: "",
};

/**
 * "Add custom plant" dialog. Creates a personal plant-library entry
 * (customForUserId) for varieties the shared library doesn't cover. Name and
 * category are required; everything else is optional — the server clamps the
 * numeric ranges. On success the list is refreshed via router.refresh();
 * PlantSearch re-syncs its plant state from the new server props.
 */
export function CreateCustomPlantDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState(EMPTY_FORM);

  function set<K extends keyof typeof EMPTY_FORM>(field: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const valid = form.name.trim().length > 0 && form.category !== null;

  function handleSubmit() {
    if (!valid || !form.category) return;
    const category = form.category;
    startTransition(async () => {
      try {
        const plant = await createCustomPlant({
          name: form.name.trim(),
          category,
          description: form.description.trim() || undefined,
          daysToMaturity: form.daysToMaturity ? parseInt(form.daysToMaturity, 10) : undefined,
          spacingInches: form.spacingInches ? parseInt(form.spacingInches, 10) : undefined,
          sunRequirement: form.sunRequirement ?? undefined,
          waterRequirement: form.waterRequirement ?? undefined,
        });
        toast.success(`Added "${plant.name}" to your library.`);
        setOpen(false);
        setForm(EMPTY_FORM);
        router.refresh();
      } catch {
        toast.error("Couldn't add the plant. Please try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="border-[#E4E4DC] text-[#1C3D0A] hover:bg-[#F4F4EC] shrink-0"
          />
        }
      >
        <Plus className="w-4 h-4 mr-1" />
        <span className="hidden sm:inline">Custom plant</span>
        <span className="sm:hidden">Custom</span>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Add a custom plant</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Plant name</Label>
            <Input
              placeholder="Cherokee Purple tomato"
              maxLength={100}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              items={CATEGORY_ITEMS}
              value={form.category}
              onValueChange={(v) => set("category", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Days to maturity</Label>
              <Input
                type="number"
                min="1"
                max="3650"
                placeholder="75"
                value={form.daysToMaturity}
                onChange={(e) => set("daysToMaturity", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Spacing (in)</Label>
              <Input
                type="number"
                min="1"
                max="120"
                placeholder="18"
                value={form.spacingInches}
                onChange={(e) => set("spacingInches", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Sun</Label>
              <Select
                items={SUN_ITEMS}
                value={form.sunRequirement}
                onValueChange={(v) => set("sunRequirement", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {SUN_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Water</Label>
              <Select
                items={WATER_ITEMS}
                value={form.waterRequirement}
                onValueChange={(v) => set("waterRequirement", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {WATER_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              placeholder="Heirloom variety from the seed swap…"
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!valid || isPending}
            className="w-full bg-[#1C3D0A] hover:bg-[#3A6B20] text-white"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add plant"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
