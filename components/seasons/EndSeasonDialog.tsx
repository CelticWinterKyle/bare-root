"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveSeason, ratePlanting } from "@/app/actions/seasons";
import { Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

type PlantingRow = {
  id: string;
  plantName: string;
  status: string;
  rating: number | null;
  growAgain: boolean | null;
};

type Props = {
  seasonId: string;
  seasonName: string;
  plantings: PlantingRow[];
};

export function EndSeasonDialog({ seasonId, seasonName, plantings }: Props) {
  const [open, setOpen] = useState(false);
  const [ratings, setRatings] = useState<Record<string, { rating: number | null; growAgain: boolean }>>(() =>
    Object.fromEntries(plantings.map((p) => [p.id, { rating: p.rating, growAgain: p.growAgain ?? false }]))
  );
  const [isSaving, startSave] = useTransition();
  const [isArchiving, startArchive] = useTransition();
  const router = useRouter();

  function setRating(id: string, rating: number) {
    setRatings((prev) => ({ ...prev, [id]: { ...prev[id], rating } }));
  }

  function toggleGrowAgain(id: string) {
    setRatings((prev) => ({ ...prev, [id]: { ...prev[id], growAgain: !prev[id].growAgain } }));
  }

  function handleSubmit() {
    startArchive(async () => {
      // Save all ratings in parallel, then archive
      await Promise.all(
        plantings.map((p) =>
          ratePlanting(p.id, { rating: ratings[p.id]?.rating ?? null, growAgain: ratings[p.id]?.growAgain ?? false })
        )
      );
      await archiveSeason(seasonId);
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="text-[#ADADAA] border-[#E4E4DC] hover:bg-[#F4F4EC]"
      >
        End season
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/20" onClick={() => !isArchiving && setOpen(false)} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md border border-[#E4E4DC] flex flex-col max-h-[80vh]">
        <div className="p-6 pb-0">
          <h2 className="font-display text-xl font-semibold text-[#111109]">End {seasonName}</h2>
          <p className="text-sm text-[#ADADAA] mt-1">Rate your plantings before archiving.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {plantings.length === 0 && (
            <p className="text-sm text-[#ADADAA] text-center py-4">No plantings this season.</p>
          )}
          {plantings.map((p) => {
            const r = ratings[p.id];
            return (
              <div key={p.id} className="border border-[#E4E4DC] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-[#111109]">{p.plantName}</span>
                  <span className="text-xs text-[#ADADAA]">{p.status.replace(/_/g, " ").toLowerCase()}</span>
                </div>
                {/* Star rating */}
                <div className="flex items-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => setRating(p.id, star)}>
                      <Star
                        className={`w-5 h-5 transition-colors ${
                          r.rating !== null && star <= r.rating
                            ? "fill-[#D4820A] text-[#D4820A]"
                            : "text-[#E4E4DC]"
                        }`}
                      />
                    </button>
                  ))}
                  {r.rating && (
                    <button
                      onClick={() => setRatings((prev) => ({ ...prev, [p.id]: { ...prev[p.id], rating: null } }))}
                      className="ml-1 text-[11px] text-[#ADADAA] hover:text-[#111109]"
                    >
                      clear
                    </button>
                  )}
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={r.growAgain}
                    onChange={() => toggleGrowAgain(p.id)}
                    className="w-3.5 h-3.5 accent-[#1C3D0A]"
                  />
                  <span className="text-xs text-[#6B6B5A]">Grow again next season</span>
                </label>
              </div>
            );
          })}
        </div>

        <div className="p-6 pt-3 border-t border-[#E4E4DC] flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={isArchiving}
            className="flex-1 bg-[#1C3D0A] hover:bg-[#3A6B20] text-white"
          >
            {isArchiving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Archive season"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isArchiving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
