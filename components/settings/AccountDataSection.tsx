"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, Loader2, Trash2 } from "lucide-react";
import { exportMyData, deleteMyAccount } from "@/app/actions/account";

export function AccountDataSection() {
  const [confirm, setConfirm] = useState("");
  const [exporting, startExport] = useTransition();
  const [deleting, startDelete] = useTransition();

  function handleExport() {
    startExport(async () => {
      try {
        const data = await exportMyData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bare-root-export-${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        toast.error("Couldn't export your data. Please try again.");
      }
    });
  }

  function handleDelete() {
    if (confirm !== "DELETE") return;
    startDelete(async () => {
      try {
        await deleteMyAccount();
        window.location.href = "/";
      } catch {
        toast.error("Couldn't delete your account. Please contact support.");
      }
    });
  }

  return (
    <div className="mt-8 space-y-3">
      <h2 className="text-sm font-semibold text-[#111109]">Your data</h2>

      <button
        onClick={handleExport}
        disabled={exporting}
        className="flex items-center gap-3 p-4 w-full bg-white border border-[#E4E4DC] rounded-xl hover:border-[#7DA84E] transition-colors text-left disabled:opacity-60"
      >
        <span className="text-[#6B6B5A]">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        </span>
        <span className="flex-1 text-sm font-medium text-[#111109]">Export my data</span>
        <span className="text-xs text-[#ADADAA]">JSON</span>
      </button>

      <div className="p-4 bg-white border border-[rgba(122,42,24,0.2)] rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <Trash2 className="w-4 h-4 text-[#7A2A18]" />
          <span className="text-sm font-medium text-[#7A2A18]">Delete account</span>
        </div>
        <p className="text-xs text-[#6B6B5A] mb-3">
          Permanently deletes your account and all your gardens, plantings, harvests, and
          photos. This cannot be undone. Type <strong>DELETE</strong> to confirm.
        </p>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="DELETE"
          className="w-full border border-[#E4E4DC] rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-[#7A2A18]"
        />
        <button
          onClick={handleDelete}
          disabled={confirm !== "DELETE" || deleting}
          className="w-full py-2 rounded-lg text-sm font-medium bg-[#7A2A18] text-white hover:bg-[#641f10] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Delete my account
        </button>
      </div>
    </div>
  );
}
