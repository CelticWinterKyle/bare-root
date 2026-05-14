"use client";

import { useEffect, useState, useTransition } from "react";
import { updateNotificationPreference } from "@/app/actions/reminders";
import { subscribeToPush, checkPushSupport } from "@/lib/push-client";
import { toast } from "sonner";
import { Mail, Smartphone, Loader2 } from "lucide-react";

type Setting = {
  type: string;
  label: string;
  description: string;
  enabled: boolean;
  channelEmail: boolean;
  channelPush: boolean;
};

export function NotificationsClient({ settings: initial }: { settings: Setting[] }) {
  const [settings, setSettings] = useState(initial);
  const [, startTransition] = useTransition();
  const [pushSubscribing, setPushSubscribing] = useState(false);
  const [pushUnsupported, setPushUnsupported] = useState(false);

  // Surface a single, contextual hint at the top of the page if the
  // current browser/device just can't do push (private mode, old browser,
  // VAPID misconfigured, etc.). Permission-denied is recoverable so we
  // don't treat that as "unsupported."
  useEffect(() => {
    const support = checkPushSupport();
    if (
      support.kind === "missing-sw" ||
      support.kind === "missing-push" ||
      support.kind === "missing-vapid"
    ) {
      setPushUnsupported(true);
    }
  }, []);

  function update(type: string, patch: Partial<Setting>) {
    setSettings((prev) => prev.map((s) => (s.type === type ? { ...s, ...patch } : s)));
    startTransition(() => updateNotificationPreference(type, patch));
  }

  async function handlePushToggle(type: string, current: boolean) {
    const next = !current;

    // Disabling never needs browser interaction — just persist.
    if (!next) {
      update(type, { channelPush: false });
      return;
    }

    // Enabling: try to subscribe before flipping the toggle so the
    // user gets feedback if it fails. The subscription is shared
    // across all notification types — subscribing once is enough.
    setPushSubscribing(true);
    try {
      await subscribeToPush();
      update(type, { channelPush: true });
      toast.success("Push notifications enabled on this device");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Couldn't enable push notifications");
    } finally {
      setPushSubscribing(false);
    }
  }

  return (
    <div>
      <div className="px-[22px] md:px-8 pt-6 pb-5" style={{ borderBottom: "1px solid #E4E4DC" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#7DA84E", marginBottom: "6px" }}>
          <span style={{ display: "block", width: "16px", height: "1.5px", background: "#7DA84E", borderRadius: "1px", flexShrink: 0 }} />
          Settings
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(24px, 4vw, 28px)", fontWeight: 800, color: "#111109", letterSpacing: "-0.025em", lineHeight: 1, fontVariationSettings: "'opsz' 28" }}>
          Notifications
        </h1>
        <p className="mt-2" style={{ color: "#6B6B5A", fontSize: "14px" }}>Choose what you get notified about and how.</p>
      </div>
      <div className="px-[22px] md:px-8 py-5">

      {pushUnsupported && (
        <div className="mb-4 p-3 rounded-xl border border-[#E4E4DC] bg-[#FFF8E7] text-xs text-[#7A4A0A]">
          <p className="font-medium">Push notifications aren't available in this browser.</p>
          <p className="mt-0.5 text-[#A06010]">
            Install Bare Root as an app (Add to Home Screen) or open it in a modern browser to enable push. Email notifications still work.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {settings.map((s) => (
          <div key={s.type} className="bg-white border border-[#E4E4DC] rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-sm font-medium text-[#111109]">{s.label}</p>
                <p className="text-xs text-[#ADADAA]">{s.description}</p>
              </div>
              <Toggle
                checked={s.enabled}
                onChange={(v) => update(s.type, { enabled: v })}
              />
            </div>

            {s.enabled && (
              <div className="flex gap-3 mt-3 pt-3 border-t border-[#F4F4EC]">
                <ChannelToggle
                  icon={<Mail className="w-3.5 h-3.5" />}
                  label="Email"
                  checked={s.channelEmail}
                  onChange={(v) => update(s.type, { channelEmail: v })}
                />
                <ChannelToggle
                  icon={pushSubscribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5" />}
                  label="Push"
                  checked={s.channelPush}
                  disabled={pushUnsupported || pushSubscribing}
                  onChange={() => handlePushToggle(s.type, s.channelPush)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
        checked ? "bg-[#1C3D0A]" : "bg-[#E4E4DC]"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function ChannelToggle({
  icon,
  label,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        checked
          ? "bg-[#F4F4EC] border-[#1C3D0A] text-[#1C3D0A]"
          : "bg-white border-[#E4E4DC] text-[#ADADAA]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
