"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addGardenNote } from "@/app/actions/journal";
import { StickyNote, Loader2 } from "lucide-react";
import { toast } from "sonner";

const MAX_NOTE_CHARS = 2000;

/**
 * Compact quick-note affordance on the garden page header — jots a
 * garden-level journal entry ("aphids on the east bed") without picking a
 * planting. Editors only; the page hides it from viewers.
 */
export function QuickNoteButton({
  gardenId,
  variant = "desktop",
}: {
  gardenId: string;
  /** "desktop" matches the ghost header buttons; "mobile" matches the
   *  mono uppercase secondary action row. */
  variant?: "desktop" | "mobile";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  const valid = body.trim().length > 0 && body.trim().length <= MAX_NOTE_CHARS;

  function handleSubmit() {
    startTransition(async () => {
      try {
        await addGardenNote(gardenId, body.trim());
        setBody("");
        setOpen(false);
        toast.success("Noted in the journal");
        router.refresh();
      } catch {
        toast.error("Couldn't save the note. Please try again.");
      }
    });
  }

  const triggerStyle: React.CSSProperties =
    variant === "mobile"
      ? {
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#3A3A30",
          padding: "7px 10px",
          borderRadius: "8px",
          border: "1px solid #E4E4DC",
          background: "#FDFDF8",
          cursor: "pointer",
        }
      : {
          fontFamily: "var(--font-body)",
          fontSize: "12px",
          fontWeight: 600,
          padding: "7px 16px",
          borderRadius: "8px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "5px",
          border: "1.5px solid #E4E4DC",
          background: "transparent",
          color: "#3A3A30",
          lineHeight: 1.2,
          flexShrink: 0,
        };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className={
              variant === "mobile"
                ? "flex-1 flex items-center justify-center gap-1.5"
                : undefined
            }
            style={triggerStyle}
          />
        }
      >
        <StickyNote className="w-3.5 h-3.5" />
        Note
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Leave a note</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <Textarea
            placeholder="Aphids on the east bed, soil's drying out fast…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MAX_NOTE_CHARS}
            autoFocus
            className="min-h-24"
          />
          <p className="text-xs text-[#ADADAA]">
            Goes in the garden journal, dated today.
          </p>
          <Button
            onClick={handleSubmit}
            disabled={!valid || isPending}
            className="w-full bg-[#1C3D0A] hover:bg-[#3d6b1e] text-white"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save note"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
