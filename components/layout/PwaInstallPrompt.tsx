"use client";

import { useEffect, useState } from "react";
import { X, Smartphone } from "lucide-react";

// Chromium fires this before showing its install UI; capturing it lets us
// trigger the real install dialog from our own CTA. Not in lib.dom.d.ts.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      // Suppress the browser's mini-infobar; we surface our own card.
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }
    function onAppInstalled() {
      setInstallEvent(null);
      setShow(false);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

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

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    // The captured event is single-use; if the user accepted, appinstalled
    // hides the card too. Either way, don't re-prompt this page load.
    setInstallEvent(null);
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
          <>
            <p className="text-xs text-[#6B6B5A] mt-0.5">
              Add to your home screen for a faster, app-like experience.
            </p>
            {installEvent && (
              <button
                onClick={install}
                className="mt-2 text-xs font-medium text-white bg-[#1C3D0A] hover:bg-[#2A5212] rounded-lg px-3 py-1.5"
              >
                Install
              </button>
            )}
          </>
        )}
      </div>
      <button onClick={dismiss} className="shrink-0 text-[#ADADAA] hover:text-[#111109]" aria-label="Dismiss">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
