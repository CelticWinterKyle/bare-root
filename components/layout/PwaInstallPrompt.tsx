"use client";

import { useEffect, useState } from "react";
import { X, Smartphone } from "lucide-react";

export function PwaInstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua);
    const standalone = (navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const STORAGE_KEY = "pwa-prompt-dismissed";
    const VISIT_KEY = "pwa-visit-count";

    if (localStorage.getItem(STORAGE_KEY)) return;

    const visits = parseInt(localStorage.getItem(VISIT_KEY) ?? "0") + 1;
    localStorage.setItem(VISIT_KEY, String(visits));

    if (visits >= 3) {
      setIsIos(ios);
      setShow(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem("pwa-prompt-dismissed", "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 bg-white border border-[#E4E4DC] rounded-2xl shadow-lg p-4 flex items-start gap-3 max-w-sm mx-auto">
      <div className="w-8 h-8 bg-[#F4F4EC] rounded-lg flex items-center justify-center shrink-0">
        <Smartphone className="w-4 h-4 text-[#1C3D0A]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#111109]">Install Bare Root</p>
        {isIos ? (
          <p className="text-xs text-[#6B6B5A] mt-0.5">
            Tap the Share button <span className="font-medium">↑</span> then &quot;Add to Home Screen&quot;
          </p>
        ) : (
          <p className="text-xs text-[#6B6B5A] mt-0.5">
            Add to your home screen for a faster, app-like experience.
          </p>
        )}
      </div>
      <button onClick={dismiss} className="shrink-0 text-[#ADADAA] hover:text-[#111109]" aria-label="Dismiss">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
