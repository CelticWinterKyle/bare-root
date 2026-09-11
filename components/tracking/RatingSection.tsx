"use client";
import { actionErrorMessage } from "@/lib/action-error";
import { toast } from "sonner";
import { useState, useTransition } from "react";
import { updatePlantingRating } from "@/app/actions/planting";
import { Star, Loader2 } from "lucide-react";

type Props = {
  plantingId: string;
  rating: number | null;
  growAgain: boolean | null;
};

export function RatingSection({ plantingId, rating: initialRating, growAgain: initialGrowAgain }: Props) {
  const [rating, setRating] = useState<number | null>(initialRating);
  const [growAgain, setGrowAgain] = useState<boolean | null>(initialGrowAgain);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleStarClick(value: number) {
    const prev = rating;
    const next = rating === value ? null : value;
    setRating(next);
    startTransition(async () => {
      try {
        await updatePlantingRating(plantingId, { rating: next });
      } catch (err) {
        // Optimistic UI must roll back, or the stars lie about what's saved.
        setRating(prev);
        toast.error(actionErrorMessage(err, "Couldn't save the rating. Please try again."));
      }
    });
  }

  function handleGrowAgain(value: boolean | null) {
    const prev = growAgain;
    const next = growAgain === value ? null : value;
    setGrowAgain(next);
    startTransition(async () => {
      try {
        await updatePlantingRating(plantingId, { growAgain: next });
      } catch (err) {
        setGrowAgain(prev);
        toast.error(actionErrorMessage(err, "Couldn't save that. Please try again."));
      }
    });
  }

  const displayedRating = hoverRating ?? rating ?? 0;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg font-semibold text-[#111109]">Season rating</h2>
        {isPending && <Loader2 className="w-4 h-4 animate-spin text-[#ADADAA]" />}
      </div>

      <div className="bg-white border border-[#E4E4DC] rounded-xl p-4 space-y-4">
        {/* Star rating */}
        <div>
          <p className="text-xs text-[#ADADAA] mb-2" style={{ fontWeight: 500, fontFamily: "var(--font-body)" }}>
            How did it grow?
          </p>
          <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(null)}>
            {[1, 2, 3, 4, 5].map((value) => {
              const filled = value <= displayedRating;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleStarClick(value)}
                  onMouseEnter={() => setHoverRating(value)}
                  className="transition-transform hover:scale-110"
                  aria-label={`Rate ${value} star${value === 1 ? "" : "s"}`}
                >
                  <Star
                    className="w-7 h-7"
                    fill={filled ? "#D4820A" : "transparent"}
                    style={{ color: filled ? "#D4820A" : "#E4E4DC" }}
                    strokeWidth={1.5}
                  />
                </button>
              );
            })}
            {rating !== null && (
              <span className="ml-2 text-sm text-[#6B6B5A]">{rating} / 5</span>
            )}
          </div>
        </div>

        {/* Grow again? */}
        <div>
          <p className="text-xs text-[#ADADAA] mb-2" style={{ fontWeight: 500, fontFamily: "var(--font-body)" }}>
            Grow this again next season?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleGrowAgain(true)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                growAgain === true
                  ? "bg-[#1C3D0A] text-white border-[#1C3D0A]"
                  : "bg-white text-[#6B6B5A] border-[#E4E4DC] hover:border-[#7DA84E]"
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => handleGrowAgain(false)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                growAgain === false
                  ? "bg-[#7A2A18] text-white border-[#7A2A18]"
                  : "bg-white text-[#6B6B5A] border-[#E4E4DC] hover:border-[#B85C3A]"
              }`}
            >
              No
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
