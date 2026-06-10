"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Bell, Check, Loader2 } from "lucide-react";
import { createSuccessionReminder } from "@/app/actions/reminders";
import { AddToBedDialog, type PickerGarden } from "@/components/plants/AddToBedDialog";

/**
 * Action row on a calendar succession-suggestion card: "Plant it" opens the
 * shared bed-choice dialog (→ bed editor with ?plant= prefill), "Remind me"
 * creates a SUCCESSION_PLANTING reminder at the suggested plant-by date.
 */
export function SuccessionActions({
  plantId,
  plantName,
  gardenId,
  suggestedDate,
  gardens,
}: {
  plantId: string;
  plantName: string;
  gardenId: string;
  suggestedDate: Date;
  gardens: PickerGarden[];
}) {
  const [isPending, startTransition] = useTransition();
  const [reminderSet, setReminderSet] = useState(false);

  function handleRemind() {
    startTransition(async () => {
      try {
        await createSuccessionReminder(plantId, gardenId, suggestedDate.toISOString(), plantName);
        setReminderSet(true);
        toast.success(
          `Reminder set for ${suggestedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
        );
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Couldn't set the reminder. Please try again");
      }
    });
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <AddToBedDialog compact plantId={plantId} plantName={plantName} gardens={gardens} />
      <button
        type="button"
        onClick={handleRemind}
        disabled={isPending || reminderSet}
        className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium border transition-colors disabled:cursor-not-allowed ${
          reminderSet
            ? "bg-[#F4F4EC] border-[#E4E4DC] text-[#3A6B20]"
            : "bg-white border-[#E4E4DC] text-[#6B6B5A] hover:border-[#1C3D0A] hover:text-[#1C3D0A] disabled:opacity-60"
        }`}
      >
        {reminderSet ? (
          <>
            <Check className="w-3.5 h-3.5" />
            Reminder set
          </>
        ) : (
          <>
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
            Remind me
          </>
        )}
      </button>
    </div>
  );
}
