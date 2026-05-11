"use client";
import { useState, useTransition } from "react";
import { addGrowthNote, deleteGrowthNote } from "@/app/actions/tracking";
import { Plus, Trash2, Loader2 } from "lucide-react";

type Note = { id: string; body: string; createdAt: Date };

type Props = { plantingId: string; notes: Note[] };

export function GrowthNotes({ plantingId, notes }: Props) {
  const [body, setBody] = useState("");
  const [isAdding, startAdd] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startDelete] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    startAdd(async () => {
      await addGrowthNote(plantingId, body.trim());
      setBody("");
    });
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    startDelete(async () => {
      await deleteGrowthNote(id);
      setDeletingId(null);
    });
  }

  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-[#1C1C1A] mb-3">Growth notes</h2>

      {notes.length > 0 && (
        <div className="space-y-2 mb-3">
          {notes.map((note) => (
            <div key={note.id} className="flex items-start justify-between gap-3 p-3 bg-[#F5F0E8] rounded-xl border border-[#E8E2D9]">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#1C1C1A] whitespace-pre-wrap">{note.body}</p>
                <p className="text-xs text-[#9E9890] mt-1">
                  {new Date(note.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <button
                onClick={() => handleDelete(note.id)}
                disabled={deletingId === note.id}
                className="text-[#9E9890] hover:text-[#B85C3A] transition-colors shrink-0 mt-0.5"
              >
                {deletingId === note.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="flex gap-2 items-start">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note…"
          rows={2}
          className="flex-1 border border-[#E8E2D9] rounded-xl px-3 py-2 text-sm text-[#1C1C1A] resize-none focus:outline-none focus:ring-1 focus:ring-[#2D5016] placeholder:text-[#9E9890]"
        />
        <button
          type="submit"
          disabled={isAdding || !body.trim()}
          className="shrink-0 p-2 bg-[#2D5016] text-white rounded-xl hover:bg-[#4A7C2F] transition-colors disabled:opacity-40"
        >
          {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </button>
      </form>
    </section>
  );
}
