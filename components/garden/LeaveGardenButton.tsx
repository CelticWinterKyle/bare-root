"use client";
import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, LogOut } from "lucide-react";
import { leaveGarden } from "@/app/actions/collaborators";

/**
 * "Leave garden" affordance for collaborators (the owner gets Settings in
 * this slot instead). Double-tap confirm matching the app's delete pattern:
 * first tap arms it for 4s, second tap calls leaveGarden and returns the
 * user to their dashboard.
 */
export function LeaveGardenButton({
  gardenId,
  variant = "desktop",
}: {
  gardenId: string;
  /** "desktop" matches the ghost header buttons; "mobile" matches the
   *  mono uppercase secondary action row. */
  variant?: "desktop" | "mobile";
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [isLeaving, startLeave] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function handleClick() {
    if (!confirm) {
      setConfirm(true);
      timerRef.current = setTimeout(() => setConfirm(false), 4000);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    startLeave(async () => {
      try {
        await leaveGarden(gardenId);
        toast.success("You've left the garden");
        router.push("/dashboard");
      } catch (err) {
        console.error(err);
        setConfirm(false);
        toast.error("Couldn't leave the garden. Please try again.");
      }
    });
  }

  const danger = "#7A2A18";
  const style: React.CSSProperties =
    variant === "mobile"
      ? {
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          padding: "7px 10px",
          borderRadius: "8px",
          border: `1px solid ${confirm ? danger : "rgba(122,42,24,0.25)"}`,
          background: confirm ? danger : "#FDFDF8",
          color: confirm ? "white" : danger,
          cursor: isLeaving ? "not-allowed" : "pointer",
          opacity: isLeaving ? 0.6 : 1,
        }
      : {
          fontFamily: "var(--font-body)",
          fontSize: "12px",
          fontWeight: 600,
          padding: "7px 16px",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          gap: "5px",
          border: `1.5px solid ${confirm ? danger : "rgba(122,42,24,0.25)"}`,
          background: confirm ? danger : "transparent",
          color: confirm ? "white" : danger,
          lineHeight: 1.2,
          flexShrink: 0,
          cursor: isLeaving ? "not-allowed" : "pointer",
          opacity: isLeaving ? 0.6 : 1,
        };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLeaving}
      className={variant === "mobile" ? "flex-1 flex items-center justify-center gap-1.5" : undefined}
      style={style}
    >
      {isLeaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
      {confirm ? "Tap again to leave" : "Leave garden"}
    </button>
  );
}
