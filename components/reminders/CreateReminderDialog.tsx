"use client";
import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCustomReminder } from "@/app/actions/reminders";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";

type GardenOption = { id: string; name: string };

// Returns an HTML datetime-local value rounded to "now plus an hour."
// Most custom reminders are "remind me later today / tomorrow" so this
// is friendlier than empty.
function defaultScheduledAt(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  // datetime-local wants local-time YYYY-MM-DDTHH:mm with no zone suffix.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreateReminderDialog({ gardens }: { gardens: GardenOption[] }) {
  const [open, setOpen] = useState(false);
  const [isSaving, startSave] = useTransition();
  const [form, setForm] = useState({
    title: "",
    body: "",
    scheduledAt: defaultScheduledAt(),
    gardenId: "",
  });

  const canSave = form.title.trim().length > 0 && form.scheduledAt.length > 0;

  function reset() {
    setForm({ title: "", body: "", scheduledAt: defaultScheduledAt(), gardenId: "" });
  }

  function handleSave() {
    if (!canSave) return;
    startSave(async () => {
      try {
        // datetime-local has no timezone; new Date(str) treats it as local
        // time, which matches what the user picked in their UI.
        const iso = new Date(form.scheduledAt).toISOString();
        await createCustomReminder({
          title: form.title.trim(),
          body: form.body.trim() || undefined,
          scheduledAt: iso,
          gardenId: form.gardenId || undefined,
        });
        toast.success("Reminder scheduled");
        reset();
        setOpen(false);
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Failed to create reminder");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            className="bg-[#1C3D0A] hover:bg-[#3d6b1e] text-white"
          />
        }
      >
        <Plus className="w-4 h-4 mr-1" />
        New reminder
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Create a reminder</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              placeholder="e.g. Move basil to bigger pots"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Details (optional)</Label>
            <Textarea
              placeholder="Any notes you want to see when the reminder fires"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>When</Label>
            <Input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
            />
          </div>

          {gardens.length > 0 && (
            <div className="space-y-1.5">
              <Label>Garden (optional)</Label>
              <select
                value={form.gardenId}
                onChange={(e) => setForm((f) => ({ ...f, gardenId: e.target.value }))}
                className="w-full border border-[#E4E4DC] rounded-md px-3 py-2 text-sm text-[#111109] bg-white focus:outline-none focus:ring-1 focus:ring-[#1C3D0A]"
              >
                <option value="">No specific garden</option>
                {gardens.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="w-full bg-[#1C3D0A] hover:bg-[#3d6b1e] text-white"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Schedule reminder"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
