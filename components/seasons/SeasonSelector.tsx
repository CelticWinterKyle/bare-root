"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Check } from "lucide-react";
import { useState } from "react";

type Season = {
  id: string;
  name: string;
  isActive: boolean;
};

type Props = {
  seasons: Season[];
  selectedId: string;
  isPro: boolean;
};

export function SeasonSelector({ seasons, selectedId, isPro }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const selected = seasons.find((s) => s.id === selectedId) ?? seasons[0];
  const visible = isPro ? seasons : seasons.filter((s) => s.isActive);

  function selectSeason(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("season", id);
    router.replace(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  if (visible.length <= 1) {
    return (
      <span className="text-sm text-[#6B6560]">
        {selected?.name ?? "No season"}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium text-[#2D5016] hover:text-[#1C1C1A] transition-colors"
      >
        {selected?.name ?? "Select season"}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-[#E8E2D9] rounded-xl shadow-md min-w-[160px] py-1 overflow-hidden">
            {visible.map((s) => (
              <button
                key={s.id}
                onClick={() => selectSeason(s.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-[#1C1C1A] hover:bg-[#F5F0E8] transition-colors"
              >
                <span>{s.name}</span>
                <span className="flex items-center gap-1.5 ml-4">
                  {s.isActive && (
                    <span className="text-[10px] text-[#4A7C2F] font-medium bg-[#F5F0E8] px-1.5 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                  {s.id === selectedId && (
                    <Check className="w-3.5 h-3.5 text-[#2D5016]" />
                  )}
                </span>
              </button>
            ))}
            {!isPro && seasons.length > 1 && (
              <div className="border-t border-[#E8E2D9] mt-1 pt-1 px-3 pb-2">
                <p className="text-[10px] text-[#9E9890]">
                  <a href="/settings/billing" className="text-[#C4790A] hover:underline">Upgrade to Pro</a> to view past seasons
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
