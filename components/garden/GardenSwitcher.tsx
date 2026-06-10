"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActiveGarden } from "@/app/actions/garden";
import { CreateGardenDialog } from "./CreateGardenDialog";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";

export type GardenOption = { id: string; name: string; subtitle: string | null };

/**
 * Garden switcher for the sidebar / mobile header. Lists every accessible
 * garden, highlights the active one, switches the active-garden cookie via
 * setActiveGarden, and offers a "New garden" entry (CreateGardenDialog handles
 * the tier upsell when at the limit).
 */
export function GardenSwitcher({
  gardens,
  activeGardenId,
  atLimit,
  style,
}: {
  gardens: GardenOption[];
  activeGardenId: string | null;
  atLimit: boolean;
  /** Optional overrides for the outer wrapper (e.g. border tweaks in the mobile header). */
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const active = gardens.find((g) => g.id === activeGardenId) ?? gardens[0] ?? null;

  function pick(id: string) {
    if (id === active?.id) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await setActiveGarden(id);
      setOpen(false);
      router.push(`/garden/${id}`);
      router.refresh();
    });
  }

  return (
    <div style={{ position: "relative", padding: "10px 12px", borderBottom: "1px solid #E4E4DC", flexShrink: 0, ...style }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          all: "unset",
          boxSizing: "border-box",
          cursor: "pointer",
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 10px",
          borderRadius: "9px",
          border: "1px solid #E4E4DC",
          background: "#FDFDF8",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: "8px", letterSpacing: "0.18em",
            textTransform: "uppercase", color: "#ADADAA", marginBottom: "1px",
          }}>
            Garden
          </div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: "14px", fontWeight: 700,
            color: "#111109", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {active?.name ?? "No garden"}
          </div>
        </div>
        {isPending ? (
          <Loader2 style={{ width: 14, height: 14, color: "#ADADAA" }} className="animate-spin" />
        ) : (
          <ChevronsUpDown style={{ width: 14, height: 14, color: "#ADADAA", flexShrink: 0 }} />
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{
            position: "absolute", top: "calc(100% - 2px)", left: 12, right: 12, zIndex: 41,
            background: "#FDFDF8", border: "1px solid #E4E4DC", borderRadius: "10px",
            boxShadow: "0 6px 24px rgba(28,61,10,0.12)", overflow: "hidden", padding: "4px",
          }}>
            {gardens.map((g) => {
              const isActive = g.id === active?.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => pick(g.id)}
                  style={{
                    all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
                    display: "flex", alignItems: "center", gap: "8px", padding: "8px 9px",
                    borderRadius: "7px", background: isActive ? "#E4F0D4" : "transparent",
                  }}
                >
                  <Check style={{ width: 14, height: 14, color: "#1C3D0A", flexShrink: 0, opacity: isActive ? 1 : 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600,
                      color: "#111109", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {g.name}
                    </div>
                    {g.subtitle && (
                      <div style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "#6B6B5A" }}>
                        {g.subtitle}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}

            <div style={{ height: 1, background: "#E4E4DC", margin: "4px 2px" }} />

            <CreateGardenDialog
              atLimit={atLimit}
              trigger={
                <div style={{
                  display: "flex", alignItems: "center", gap: "8px", padding: "8px 9px",
                  borderRadius: "7px", color: "#3A6B20",
                  fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600,
                }}>
                  <Plus style={{ width: 14, height: 14 }} />
                  New garden
                </div>
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
