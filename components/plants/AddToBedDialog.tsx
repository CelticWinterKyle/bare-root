"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sprout, ArrowRight } from "lucide-react";

type Bed = {
  id: string;
  name: string;
  widthFt: number;
  heightFt: number;
  emptyCellCount: number;
};

type Garden = {
  id: string;
  name: string;
  hasActiveSeason: boolean;
  beds: Bed[];
};

type Props = {
  plantId: string;
  plantName: string;
  gardens: Garden[];
};

export function AddToBedDialog({ plantId, plantName, gardens }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const totalBeds = gardens.reduce((sum, g) => sum + g.beds.length, 0);
  const hasUsableGarden = gardens.some((g) => g.hasActiveSeason && g.beds.length > 0);

  function handleBedClick(gardenId: string, bedId: string) {
    setOpen(false);
    router.push(`/garden/${gardenId}/beds/${bedId}?plant=${plantId}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="lg"
            className="bg-[#1C3D0A] hover:bg-[#3d6b1e] text-white"
          />
        }
      >
        <Sprout className="w-4 h-4 mr-2" />
        Add to a bed
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            Add <span className="italic text-[#1C3D0A]">{plantName}</span> to a bed
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2">
          {totalBeds === 0 ? (
            <div className="text-center py-8 text-sm text-[#6B6B5A]">
              <p className="mb-2">You don't have any beds yet.</p>
              <Button
                onClick={() => { setOpen(false); router.push("/garden"); }}
                variant="outline"
                size="sm"
                className="border-[#E4E4DC]"
              >
                Go to your garden →
              </Button>
            </div>
          ) : !hasUsableGarden ? (
            <div className="text-center py-8 text-sm text-[#6B6B5A]">
              <p className="mb-2">None of your gardens have an active season.</p>
              <p className="text-xs text-[#ADADAA] mb-4">Plantings are tracked by season — start one to add plants.</p>
              <Button
                onClick={() => { setOpen(false); router.push(`/garden/${gardens[0].id}/seasons`); }}
                variant="outline"
                size="sm"
                className="border-[#E4E4DC]"
              >
                Manage seasons →
              </Button>
            </div>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {gardens.map((garden) => (
                <div key={garden.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p
                      className="text-xs"
                      style={{
                        fontFamily: "var(--font-mono)",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "#6B6B5A",
                      }}
                    >
                      {garden.name}
                    </p>
                    {!garden.hasActiveSeason && (
                      <span className="text-[10px] text-[#D4820A] font-medium">No active season</span>
                    )}
                  </div>
                  {garden.beds.length === 0 ? (
                    <p className="text-xs text-[#ADADAA] italic py-2">No beds in this garden</p>
                  ) : (
                    <div className="space-y-1.5">
                      {garden.beds.map((bed) => {
                        const disabled = !garden.hasActiveSeason;
                        const full = bed.emptyCellCount === 0;
                        return (
                          <button
                            key={bed.id}
                            type="button"
                            onClick={() => !disabled && !full && handleBedClick(garden.id, bed.id)}
                            disabled={disabled || full}
                            className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-[#E4E4DC] bg-white hover:bg-[#F4F4EC] hover:border-[#7DA84E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-[#E4E4DC] text-left"
                          >
                            <div>
                              <p className="text-sm font-medium text-[#111109]">{bed.name}</p>
                              <p className="text-xs text-[#ADADAA] mt-0.5">
                                {bed.widthFt} × {bed.heightFt} ft ·{" "}
                                {full
                                  ? "All cells planted"
                                  : `${bed.emptyCellCount} empty cell${bed.emptyCellCount === 1 ? "" : "s"}`}
                              </p>
                            </div>
                            {!disabled && !full && (
                              <ArrowRight className="w-4 h-4 text-[#7DA84E] shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
