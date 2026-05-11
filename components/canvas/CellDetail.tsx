"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { removePlanting, updatePlantingStatus } from "@/app/actions/planting";
import { Loader2, Trash2 } from "lucide-react";
import type { PlantingStatus } from "@/lib/generated/prisma/enums";
import Link from "next/link";

const STATUSES: { value: PlantingStatus; label: string; color: string }[] = [
  { value: "PLANNED", label: "Planned", color: "bg-[#8FA86B] text-white" },
  { value: "SEEDS_STARTED", label: "Seeds started", color: "bg-[#D4A843] text-white" },
  { value: "TRANSPLANTED", label: "Transplanted", color: "bg-[#7AB648] text-white" },
  { value: "ACTIVE", label: "Active", color: "bg-[#4A7C2F] text-white" },
  { value: "HARVESTING", label: "Harvesting", color: "bg-[#C4790A] text-white" },
  { value: "HARVESTED", label: "Harvested", color: "bg-[#9E9890] text-white" },
  { value: "FAILED", label: "Failed", color: "bg-[#B85C3A] text-white" },
];

type CompanionWarning = {
  type: "BENEFICIAL" | "HARMFUL";
  plantName: string;
  notes: string | null;
};

type Props = {
  planting: {
    id: string;
    status: PlantingStatus;
    plant: { id: string; name: string; category: string };
    cell: { row: number; col: number };
  };
  warnings: CompanionWarning[];
  onClose: () => void;
};

export function CellDetail({ planting, warnings, onClose }: Props) {
  const [status, setStatus] = useState<PlantingStatus>(planting.status);
  const [isUpdating, startUpdate] = useTransition();
  const [isRemoving, startRemove] = useTransition();

  const beneficial = warnings.filter((w) => w.type === "BENEFICIAL");
  const harmful = warnings.filter((w) => w.type === "HARMFUL");

  function handleStatusChange(s: PlantingStatus) {
    setStatus(s);
    startUpdate(async () => {
      await updatePlantingStatus(planting.id, s);
    });
  }

  function handleRemove() {
    startRemove(async () => {
      await removePlanting(planting.id);
      onClose();
    });
  }

  const statusInfo = STATUSES.find((s) => s.value === status);

  return (
    <div className="space-y-4">
      {/* Plant name */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={`/plants/${planting.plant.id}`}
            className="font-display text-xl font-semibold text-[#1C1C1A] hover:text-[#2D5016] transition-colors"
          >
            {planting.plant.name}
          </Link>
          <p className="text-sm text-[#9E9890] mt-0.5">
            Row {planting.cell.row + 1}, Col {planting.cell.col + 1}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusInfo?.color}`}>
          {statusInfo?.label}
        </span>
      </div>

      {/* Status buttons */}
      <div>
        <p className="text-xs text-[#9E9890] font-medium uppercase tracking-wide mb-2">
          Status
        </p>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => handleStatusChange(s.value)}
              disabled={isUpdating}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-opacity ${
                status === s.value ? s.color : "bg-[#F5F0E8] text-[#6B6560]"
              } disabled:opacity-50`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Companion warnings */}
      {(harmful.length > 0 || beneficial.length > 0) && (
        <div>
          <p className="text-xs text-[#9E9890] font-medium uppercase tracking-wide mb-2">
            Companions in this bed
          </p>
          {harmful.length > 0 && (
            <div className="mb-2 p-2.5 bg-red-50 rounded-lg border border-red-100">
              <p className="text-xs font-medium text-[#B85C3A] mb-1">⚠ Conflicts with</p>
              {harmful.map((w) => (
                <p key={w.plantName} className="text-xs text-[#B85C3A]">
                  {w.plantName}{w.notes ? ` — ${w.notes}` : ""}
                </p>
              ))}
            </div>
          )}
          {beneficial.length > 0 && (
            <div className="p-2.5 bg-[#F5F0E8] rounded-lg border border-[#E8E2D9]">
              <p className="text-xs font-medium text-[#4A7C2F] mb-1">✓ Beneficial with</p>
              {beneficial.map((w) => (
                <p key={w.plantName} className="text-xs text-[#6B6560]">
                  {w.plantName}{w.notes ? ` — ${w.notes}` : ""}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Remove */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRemove}
        disabled={isRemoving}
        className="w-full text-[#B85C3A] hover:text-[#B85C3A] hover:bg-red-50"
      >
        {isRemoving ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Trash2 className="w-4 h-4 mr-2" />
        )}
        Remove plant
      </Button>
    </div>
  );
}
