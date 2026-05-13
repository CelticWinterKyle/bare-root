"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSeason } from "@/app/actions/seasons";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  gardenId: string;
  hasActiveSeason: boolean;
};

export function CreateSeasonDialog({ gardenId, hasActiveSeason }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggestSeasonName());
  const [startDate, setStartDate] = useState(toInputDate(new Date()));
  const [setActive, setSetActive] = useState(!hasActiveSeason);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await createSeason(gardenId, { name, startDate, setActive });
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
        className="flex items-center gap-1.5 text-[#1C3D0A] border-[#1C3D0A] hover:bg-[#F4F4EC]"
      >
        <Plus className="w-4 h-4" />
        New season
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/20" onClick={() => setOpen(false)} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-[#E4E4DC]">
        <h2 className="font-display text-xl font-semibold text-[#111109] mb-4">New season</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-[#6B6B5A] block mb-1">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Spring 2026"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#6B6B5A] block mb-1">Start date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={setActive}
              onChange={(e) => setSetActive(e.target.checked)}
              className="w-4 h-4 accent-[#1C3D0A]"
            />
            <span className="text-sm text-[#111109]">Set as active season</span>
          </label>
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={isPending} className="flex-1 bg-[#1C3D0A] hover:bg-[#3A6B20] text-white">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create season"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function suggestSeasonName(): string {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const season =
    month < 3 ? "Winter" :
    month < 6 ? "Spring" :
    month < 9 ? "Summer" : "Fall";
  return `${season} ${year}`;
}

function toInputDate(d: Date): string {
  return d.toISOString().split("T")[0];
}
