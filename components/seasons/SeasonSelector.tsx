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
      <span className="text-sm text-[#6B6B5A]">
        {selected?.name ?? "No season"}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium text-[#1C3D0A] hover:text-[#111109] transition-colors"
      >
        {selected?.name ?? "Select season"}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-[#E4E4DC] rounded-xl shadow-md min-w-[160px] py-1 overflow-hidden">
            {visible.map((s) => (
              <button
                key={s.id}
                onClick={() => selectSeason(s.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-[#111109] hover:bg-[#F4F4EC] transition-colors"
              >
                <span>{s.name}</span>
                <span className="flex items-center gap-1.5 ml-4">
                  {s.isActive && (
                    <span className="text-[10px] text-[#3A6B20] font-medium bg-[#F4F4EC] px-1.5 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                  {s.id === selectedId && (
                    <Check className="w-3.5 h-3.5 text-[#1C3D0A]" />
                  )}
                </span>
              </button>
            ))}
            {!isPro && seasons.length > 1 && (
              <div className="border-t border-[#E4E4DC] mt-1 pt-1 px-3 pb-2">
                <p className="text-[10px] text-[#ADADAA]">
                  <a href="/settings/billing" className="text-[#D4820A] hover:underline">Upgrade to Pro</a> to view past seasons
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
