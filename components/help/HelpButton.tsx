"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { HelpSheet } from "./HelpSheet";

/**
 * "?" icon button that opens the field-guide glossary. Sized to match the
 * header's other round icon buttons (bell, settings) so it slots into the
 * mobile header or the desktop sidebar footer unchanged.
 */
export function HelpButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Help — field guide"
        onClick={() => setOpen(true)}
        className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F4F4EC] transition-colors"
      >
        <HelpCircle className="w-[18px] h-[18px] text-[#3A3A30]" strokeWidth={1.8} />
      </button>
      <HelpSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
