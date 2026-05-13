"use client";
import { useState, useTransition } from "react";
import { generateLayoutAction, acceptLayoutAssignments } from "@/app/actions/smart-layout";
import { searchPlantsAction } from "@/app/actions/plants";
import type { LayoutAssignment } from "@/lib/services/smart-layout";
import { Sparkles, Search, X, Loader2, Check, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

type Plant = {
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
  daysToMaturity: number | null;
};

type Props = {
  bedId: string;
  seasonId: string;
  userId: string;
  recentPlants: Plant[];
  onAssignmentsAccepted: (assignments: LayoutAssignment[]) => void;
  onHoverAssignment?: (coords: { row: number; col: number } | null) => void;
  onClose: () => void;
};

type Step = "wishlist" | "generating" | "results";

export function SmartLayoutPanel({
  bedId,
  seasonId,
  userId,
  recentPlants,
  onAssignmentsAccepted,
  onHoverAssignment,
  onClose,
}: Props) {
  const [step, setStep] = useState<Step>("wishlist");
  const [wishlist, setWishlist] = useState<Plant[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Plant[]>(recentPlants);
  const [assignments, setAssignments] = useState<LayoutAssignment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [isAccepting, startAccept] = useTransition();

  function handleSearch(q: string) {
    setQuery(q);
    if (q.length < 2) { setSearchResults(recentPlants); return; }
    startSearch(async () => {
      const found = await searchPlantsAction(q, null, userId);
      setSearchResults(found);
    });
  }

  function toggleWishlist(plant: Plant) {
    setWishlist((prev) =>
      prev.find((p) => p.id === plant.id)
        ? prev.filter((p) => p.id !== plant.id)
        : [...prev, plant]
    );
  }

  async function handleGenerate() {
    setStep("generating");
    setError(null);
    const result = await generateLayoutAction(bedId, seasonId, wishlist.map((p) => p.id));
    if (result.error) {
      setError(result.error);
      setStep("wishlist");
    } else {
      setAssignments(result.assignments);
      setStep("results");
    }
  }

  function handleAccept() {
    startAccept(async () => {
      await acceptLayoutAssignments(bedId, seasonId, assignments);
      onAssignmentsAccepted(assignments);
      onClose();
    });
  }

  function handleRegenerate() {
    setStep("wishlist");
    setAssignments([]);
  }

  if (step === "generating") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-10 h-10 rounded-full bg-[#F4F4EC] flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-[#7DA84E] animate-pulse" />
        </div>
        <p className="text-sm font-medium text-[#111109]">Planning your bed…</p>
        <p className="text-xs text-[#ADADAA]">Optimizing for sun, spacing & companions</p>
      </div>
    );
  }

  if (step === "results") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#7DA84E]" />
          <span className="font-display text-sm font-semibold text-[#111109]">
            {assignments.length} plant{assignments.length !== 1 ? "s" : ""} placed
          </span>
        </div>

        <div className="space-y-2 max-h-[280px] overflow-y-auto">
          {assignments.map((a, i) => (
            <div
              key={i}
              className="p-2.5 bg-[#F4F4EC] rounded-lg border border-[#E4E4DC] cursor-default"
              onMouseEnter={() => onHoverAssignment?.({ row: a.row, col: a.col })}
              onMouseLeave={() => onHoverAssignment?.(null)}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-sm font-medium text-[#111109]">{a.plantName}</span>
                <span className="text-xs text-[#ADADAA]">
                  Row {a.row + 1}, Col {a.col + 1}
                </span>
              </div>
              <p className="text-xs text-[#6B6B5A]">{a.reasoning}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            onClick={handleAccept}
            disabled={isAccepting}
            className="w-full bg-[#1C3D0A] hover:bg-[#3A6B20] text-white"
          >
            {isAccepting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
            Accept layout
          </Button>
          <Button variant="ghost" onClick={handleRegenerate} className="w-full text-[#6B6B5A]">
            <RotateCcw className="w-4 h-4 mr-2" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  // Wishlist step
  return (
    <div className="flex flex-col h-full gap-3">
      {error && (
        <div className="p-2.5 bg-red-50 border border-red-100 rounded-lg text-xs text-[#B85C3A]">
          {error === "UPGRADE_REQUIRED" ? (
            <>Smart layout is a Pro feature. <Link href="/settings/billing" className="underline">Upgrade</Link></>
          ) : error}
        </div>
      )}

      {/* Wishlist */}
      {wishlist.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {wishlist.map((p) => (
            <span
              key={p.id}
              className="flex items-center gap-1 text-xs bg-[#1C3D0A] text-white px-2 py-1 rounded-full"
            >
              {p.name}
              <button onClick={() => toggleWishlist(p)}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADADAA]" />
        <Input
          autoFocus
          placeholder="Add plants to wishlist…"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#ADADAA]" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {searchResults.map((plant) => {
          const selected = !!wishlist.find((p) => p.id === plant.id);
          return (
            <button
              key={plant.id}
              onClick={() => toggleWishlist(plant)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left ${
                selected ? "bg-[#1C3D0A]/10 border border-[#1C3D0A]/20" : "hover:bg-[#F4F4EC]"
              }`}
            >
              {plant.imageUrl ? (
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#F4F4EC] shrink-0 relative">
                  <Image src={plant.imageUrl} alt={plant.name} fill className="object-cover" sizes="32px" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-[#F4F4EC] flex items-center justify-center shrink-0 text-[#ADADAA] text-xs">
                  {plant.name[0]}
                </div>
              )}
              <span className="text-sm text-[#111109] truncate flex-1">{plant.name}</span>
              {selected && <Check className="w-4 h-4 text-[#1C3D0A] shrink-0" />}
            </button>
          );
        })}
      </div>

      <Button
        onClick={handleGenerate}
        disabled={wishlist.length === 0}
        className="w-full bg-[#1C3D0A] hover:bg-[#3A6B20] text-white disabled:opacity-40"
      >
        <Sparkles className="w-4 h-4 mr-2" />
        Plan bed ({wishlist.length} plant{wishlist.length !== 1 ? "s" : ""})
      </Button>
    </div>
  );
}
