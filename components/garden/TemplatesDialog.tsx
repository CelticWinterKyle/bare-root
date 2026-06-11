"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LayoutTemplate, Loader2, Trash2, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listTemplates,
  applyTemplate,
  saveBedAsTemplate,
  deleteTemplate,
  duplicateBed,
} from "@/app/actions/templates";

type TemplateRow = Awaited<ReturnType<typeof listTemplates>>[number];

/**
 * Bed templates: apply a curated or saved plan to this bed, save the current
 * bed as a template, or duplicate the whole bed. Lives in the bed page
 * header — the answer to "64 empty cells, now what?".
 */
export function TemplatesDialog({
  bedId,
  gardenId,
  seasonId,
  bedCols,
  bedRows,
}: {
  bedId: string;
  gardenId: string;
  seasonId: string;
  bedCols: number;
  bedRows: number;
}) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateRow[] | null>(null);
  const [saveName, setSaveName] = useState("");
  const [isWorking, startWork] = useTransition();
  const router = useRouter();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && templates === null) {
      listTemplates()
        .then(setTemplates)
        .catch(() => toast.error("Couldn't load templates"));
    }
  }

  function handleApply(t: TemplateRow) {
    startWork(async () => {
      try {
        const res = await applyTemplate(t.id, bedId, seasonId);
        if (res.planted === 0) {
          toast.error("Nothing planted — the cells it needs are occupied.");
        } else {
          toast.success(
            `Planted ${res.planted} from “${t.name}”${res.skipped > 0 ? ` · ${res.skipped} skipped` : ""}`
          );
          setOpen(false);
          router.refresh();
        }
      } catch (err) {
        console.error(err);
        toast.error("Couldn't apply the template. Please try again.");
      }
    });
  }

  function handleSave() {
    const name = saveName.trim();
    if (!name) return;
    startWork(async () => {
      try {
        const res = await saveBedAsTemplate(bedId, seasonId, name);
        toast.success(`Saved “${name}” (${res.plants} plants)`);
        setSaveName("");
        setTemplates(null); // refetch on next open section render
        listTemplates().then(setTemplates).catch(() => {});
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save the template.");
      }
    });
  }

  function handleDelete(t: TemplateRow) {
    startWork(async () => {
      try {
        await deleteTemplate(t.id);
        setTemplates((prev) => prev?.filter((x) => x.id !== t.id) ?? null);
      } catch {
        toast.error("Couldn't delete that template.");
      }
    });
  }

  function handleDuplicate() {
    startWork(async () => {
      try {
        const res = await duplicateBed(bedId);
        toast.success(`Bed duplicated${res.planted > 0 ? ` with ${res.planted} plantings` : ""}`);
        setOpen(false);
        router.push(`/garden/${gardenId}/beds/${res.newBedId}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't duplicate the bed.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[#EAEADE]"
        style={{ background: "#F4F4EC", color: "#3A3A30", border: "1px solid #E4E4DC" }}
      >
        <LayoutTemplate className="w-3.5 h-3.5" style={{ color: "#3A6B20" }} />
        Templates
      </button>
      <DialogContent className="max-w-md" style={{ background: "#FDFDF8" }}>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}>
            Bed templates
          </DialogTitle>
        </DialogHeader>

        {templates === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-[#ADADAA]" />
          </div>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {templates.map((t) => {
              const fits = t.gridCols <= bedCols && t.gridRows <= bedRows;
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 p-3 rounded-xl border"
                  style={{ background: "#FFFFFF", borderColor: "#E4E4DC" }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#111109]">
                      {t.name}
                      {t.userId === null && (
                        <span
                          className="ml-2 align-middle"
                          style={{
                            fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.1em",
                            textTransform: "uppercase", padding: "2px 6px", borderRadius: 100,
                            background: "#E4F0D4", color: "#1C3D0A",
                          }}
                        >
                          Starter
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[#6B6B5A]">
                      {t.gridCols}×{t.gridRows} grid · {t._count.assignments} plants
                      {!fits && " · larger than this bed"}
                    </p>
                    {t.description && <p className="text-xs text-[#6B6B5A] mt-0.5">{t.description}</p>}
                  </div>
                  {t.userId !== null && (
                    <button
                      type="button"
                      onClick={() => handleDelete(t)}
                      disabled={isWorking}
                      className="shrink-0 p-1.5 rounded-md text-[#ADADAA] hover:text-[#7A2A18] hover:bg-[#FBF0EE] transition-colors"
                      aria-label={`Delete template ${t.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleApply(t)}
                    disabled={isWorking || !seasonId}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50"
                    style={{ background: "#1C3D0A" }}
                  >
                    Apply
                  </button>
                </div>
              );
            })}
            {templates.length === 0 && (
              <p className="text-sm text-[#6B6B5A] py-6 text-center">No templates yet.</p>
            )}
          </div>
        )}

        {/* Save current bed */}
        <div className="pt-3" style={{ borderTop: "1px solid #E4E4DC" }}>
          <p className="text-xs font-medium text-[#3A3A30] mb-1.5">Save this bed as a template</p>
          <div className="flex gap-2">
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g. Robyn's spring plan"
              maxLength={60}
              className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7DA84E]"
              style={{ background: "#F4F4EC", border: "1px solid #E4E4DC", color: "#111109" }}
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={isWorking || saveName.trim().length === 0}
              className="px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              style={{ background: "#E4F0D4", color: "#1C3D0A" }}
            >
              Save
            </button>
          </div>
        </div>

        {/* Duplicate */}
        <button
          type="button"
          onClick={handleDuplicate}
          disabled={isWorking}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-xs font-medium transition-colors hover:bg-[#EAEADE] disabled:opacity-50"
          style={{ background: "#F4F4EC", color: "#3A3A30", border: "1px solid #E4E4DC" }}
        >
          <Copy className="w-3.5 h-3.5" />
          Duplicate this bed{" "}
          <span className="text-[#6B6B5A]">(layout + plantings)</span>
        </button>
      </DialogContent>
    </Dialog>
  );
}
