"use client";

import { useState, useTransition } from "react";
import { updateNotificationPreference } from "@/app/actions/reminders";
import { Bell, Mail, Smartphone } from "lucide-react";

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

  function update(type: string, patch: Partial<Setting>) {
    setSettings((prev) => prev.map((s) => (s.type === type ? { ...s, ...patch } : s)));
    startTransition(() => updateNotificationPreference(type, patch));
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
                  icon={<Smartphone className="w-3.5 h-3.5" />}
                  label="Push"
                  checked={s.channelPush}
                  onChange={(v) => update(s.type, { channelPush: v })}
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
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
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
