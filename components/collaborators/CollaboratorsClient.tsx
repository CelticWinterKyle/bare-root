"use client";

import { useState, useTransition } from "react";
import { inviteCollaborator, removeCollaborator, updateCollaboratorRole, cancelInvitation } from "@/app/actions/collaborators";
import { UserPlus, X, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";

const ROLE_ITEMS: { value: "EDITOR" | "VIEWER"; label: string }[] = [
  { value: "EDITOR", label: "Editor" },
  { value: "VIEWER", label: "Viewer" },
];

const INVITE_ROLE_ITEMS: { value: "EDITOR" | "VIEWER"; label: string }[] = [
  { value: "EDITOR", label: "Editor — can plant & edit" },
  { value: "VIEWER", label: "Viewer — read only" },
];

type Collaborator = {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  role: string;
};

type PendingInvitation = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
};

type Props = {
  gardenId: string;
  collaborators: Collaborator[];
  pendingInvitations: PendingInvitation[];
};

export function CollaboratorsClient({ gardenId, collaborators, pendingInvitations }: Props) {
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"EDITOR" | "VIEWER">("EDITOR");
  const [error, setError] = useState<string | null>(null);
  const [isInviting, startInvite] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [, startRemove] = useTransition();
  const [, startCancel] = useTransition();

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startInvite(async () => {
      try {
        await inviteCollaborator(gardenId, email, role as never);
        setEmail("");
        setShowInvite(false);
      } catch (err: unknown) {
        if (err instanceof Error) {
          if (err.message === "COLLABORATOR_LIMIT_REACHED") setError("You've reached the 5-collaborator limit.");
          else if (err.message === "CANNOT_INVITE_SELF") setError("You're already here — no need to invite yourself.");
          else setError("That invite didn't go through. Give it another try.");
        }
      }
    });
  }

  function handleRemove(userId: string, collabId: string) {
    setRemovingId(collabId);
    startRemove(async () => {
      await removeCollaborator(gardenId, userId);
      setRemovingId(null);
    });
  }

  function handleRoleChange(userId: string, newRole: string) {
    startRemove(async () => {
      await updateCollaboratorRole(gardenId, userId, newRole as never);
    });
  }

  function handleCancelInvite(invitationId: string) {
    startCancel(async () => {
      await cancelInvitation(gardenId, invitationId);
    });
  }

  const total = collaborators.length + pendingInvitations.length;

  return (
    <div className="space-y-3">
      {collaborators.map((c) => (
        <div key={c.id} className="flex items-center gap-3 p-3 bg-white border border-[#E4E4DC] rounded-xl">
          {c.avatarUrl ? (
            <Image src={c.avatarUrl} alt="" width={32} height={32} className="rounded-full shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#F4F4EC] flex items-center justify-center text-xs font-medium text-[#6B6B5A] shrink-0">
              {(c.name ?? c.email)[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#111109] truncate">{c.name ?? c.email}</p>
            {c.name && <p className="text-xs text-[#ADADAA] truncate">{c.email}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Select
              items={ROLE_ITEMS}
              value={(c.role === "VIEWER" ? "VIEWER" : "EDITOR") as "EDITOR" | "VIEWER"}
              onValueChange={(v) => v && handleRoleChange(c.userId, v)}
            >
              <SelectTrigger
                size="sm"
                aria-label="Collaborator role"
                className="text-xs text-[#6B6B5A] bg-[#F4F4EC] border-[#E4E4DC] rounded-lg"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => handleRemove(c.userId, c.id)}
              disabled={removingId === c.id}
              className="text-[#ADADAA] hover:text-[#B85C3A] transition-colors"
              aria-label="Remove collaborator"
            >
              {removingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            </button>
          </div>
        </div>
      ))}

      {pendingInvitations.map((inv) => (
        <div key={inv.id} className="flex items-center gap-3 p-3 bg-[#F4F4EC] border border-dashed border-[#E4E4DC] rounded-xl">
          <div className="w-8 h-8 rounded-full bg-white border border-[#E4E4DC] flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-[#ADADAA]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#6B6B5A] truncate">{inv.email}</p>
            <p className="text-xs text-[#ADADAA]">Invite pending · {inv.role.toLowerCase()}</p>
          </div>
          <button
            onClick={() => handleCancelInvite(inv.id)}
            className="text-[#ADADAA] hover:text-[#B85C3A] transition-colors shrink-0"
            aria-label="Cancel invitation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      {total === 0 && !showInvite && (
        <p className="text-sm text-[#ADADAA] text-center py-4">Just you out here so far.</p>
      )}

      {showInvite ? (
        <form onSubmit={handleInvite} className="bg-white border border-[#E4E4DC] rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-[#111109]">Invite someone in</p>
          <Input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <Select
            items={INVITE_ROLE_ITEMS}
            value={role}
            onValueChange={(v) => v && setRole(v)}
          >
            <SelectTrigger className="w-full" aria-label="Invite role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVITE_ROLE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-xs text-[#B85C3A]">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={isInviting} className="bg-[#1C3D0A] hover:bg-[#3A6B20] text-white">
              {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send invite"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setShowInvite(false); setError(null); }}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        total < 5 && (
          <button
            onClick={() => setShowInvite(true)}
            className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-[#E4E4DC] rounded-xl text-sm text-[#6B6B5A] hover:text-[#1C3D0A] hover:border-[#1C3D0A] transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Invite collaborator ({5 - total} remaining)
          </button>
        )
      )}
    </div>
  );
}
