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
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl font-semibold text-[#111109] mb-2">Notifications</h1>
      <p className="text-sm text-[#6B6B5A] mb-8">Choose what you get notified about and how.</p>

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
