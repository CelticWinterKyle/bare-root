"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createGarden } from "@/app/actions/garden";
import { lookupLocation } from "@/app/actions/location";
import { Loader2, MapPin, Sparkles } from "lucide-react";
import { toast } from "sonner";

type LocState = "idle" | "loading" | "found" | "not-found";

/**
 * "New garden" dialog. Creates a garden + its first active season (you add
 * beds in the editor afterward). When the user is at their tier limit
 * (`atLimit`), the dialog shows an upgrade prompt instead of the form. The
 * `trigger` is rendered as-is and opens the dialog on click, so callers can
 * pass a card, a menu row, or a button.
 */
export function CreateGardenDialog({
  atLimit,
  trigger,
}: {
  atLimit: boolean;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", widthFt: "", heightFt: "", zip: "" });
  const [loc, setLoc] = useState<LocState>("idle");
  const [zone, setZone] = useState("");
  const [lastFrost, setLastFrost] = useState<string | null>(null);
  const [firstFrost, setFirstFrost] = useState<string | null>(null);

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const valid =
    form.name.trim().length > 0 &&
    parseFloat(form.widthFt) > 0 &&
    parseFloat(form.heightFt) > 0;

  function handleLookup() {
    const zip = form.zip.trim();
    if (zip.length < 5) return;
    setLoc("loading");
    startTransition(async () => {
      const result = await lookupLocation(zip);
      if (result) {
        setZone(result.zone);
        setLastFrost(result.lastFrostDate);
        setFirstFrost(result.firstFrostDate);
        setLoc("found");
      } else {
        setZone("");
        setLastFrost(null);
        setFirstFrost(null);
        setLoc("not-found");
      }
    });
  }

  function handleSubmit() {
    startTransition(async () => {
      try {
        const gardenId = await createGarden({
          gardenName: form.name.trim(),
          widthFt: parseFloat(form.widthFt),
          heightFt: parseFloat(form.heightFt),
          zip: form.zip.trim(),
          zone,
          lastFrostDate: lastFrost,
          firstFrostDate: firstFrost,
        });
        setOpen(false);
        router.push(`/garden/${gardenId}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        toast.error(
          msg === "UPGRADE_REQUIRED"
            ? "Upgrade to Pro to add more gardens."
            : "Couldn't create the garden. Please try again."
        );
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}
      >
        {trigger}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">
              {atLimit ? "Add another garden" : "New garden"}
            </DialogTitle>
          </DialogHeader>

          {atLimit ? (
            <div className="mt-2 space-y-4">
              <div className="flex items-start gap-3 rounded-xl bg-[#FDF2E0] border border-[#F0D8A0] p-3">
                <Sparkles className="w-5 h-5 text-[#D4820A] shrink-0 mt-0.5" />
                <p className="text-sm text-[#6B6B5A]">
                  The free plan includes one garden. Upgrade to Pro for unlimited
                  gardens and beds.
                </p>
              </div>
              <Link
                href="/settings/billing"
                className="block w-full text-center bg-[#1C3D0A] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#3A6B20] transition-colors"
              >
                Upgrade to Pro
              </Link>
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Garden name</Label>
                <Input
                  placeholder="Back yard"
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
                    placeholder="20"
                    value={form.widthFt}
                    onChange={(e) => set("widthFt", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Length (ft)</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="30"
                    value={form.heightFt}
                    onChange={(e) => set("heightFt", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Zip code (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="90210"
                    value={form.zip}
                    onChange={(e) => {
                      set("zip", e.target.value);
                      setLoc("idle");
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleLookup}
                    disabled={form.zip.trim().length < 5 || loc === "loading"}
                    className="border-[#E4E4DC] text-[#1C3D0A] hover:bg-[#F4F4EC] shrink-0"
                  >
                    {loc === "loading" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Look up"
                    )}
                  </Button>
                </div>
                {loc === "found" && (
                  <p className="text-xs text-[#3A6B20] flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Zone {zone}
                    {lastFrost ? ` · last frost ${lastFrost}` : ""}
                  </p>
                )}
                {loc === "not-found" && (
                  <p className="text-xs text-[#6B6B5A]">
                    No data for that zip. You can set frost dates later in garden
                    settings.
                  </p>
                )}
              </div>
              <Button
                onClick={handleSubmit}
                disabled={!valid || isPending}
                className="w-full bg-[#1C3D0A] hover:bg-[#3A6B20] text-white"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create garden"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
