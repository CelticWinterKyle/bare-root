"use client";

import { useState, useTransition } from "react";
import { inviteCollaborator, removeCollaborator, updateCollaboratorRole, cancelInvitation } from "@/app/actions/collaborators";
import { UserPlus, X, Clock, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";

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
          else if (err.message === "CANNOT_INVITE_SELF") setError("You can't invite yourself.");
          else setError("Something went wrong. Try again.");
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
        <div key={c.id} className="flex items-center gap-3 p-3 bg-white border border-[#E8E2D9] rounded-xl">
          {c.avatarUrl ? (
            <Image src={c.avatarUrl} alt="" width={32} height={32} className="rounded-full shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#F5F0E8] flex items-center justify-center text-xs font-medium text-[#6B6560] shrink-0">
              {(c.name ?? c.email)[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#1C1C1A] truncate">{c.name ?? c.email}</p>
            {c.name && <p className="text-xs text-[#9E9890] truncate">{c.email}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <select
                value={c.role}
                onChange={(e) => handleRoleChange(c.userId, e.target.value)}
                className="appearance-none text-xs text-[#6B6560] bg-[#F5F0E8] border border-[#E8E2D9] rounded-lg pl-2 pr-6 py-1 focus:outline-none focus:ring-1 focus:ring-[#2D5016]"
              >
                <option value="EDITOR">Editor</option>
                <option value="VIEWER">Viewer</option>
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9E9890] pointer-events-none" />
            </div>
            <button
              onClick={() => handleRemove(c.userId, c.id)}
              disabled={removingId === c.id}
              className="text-[#9E9890] hover:text-[#B85C3A] transition-colors"
              aria-label="Remove collaborator"
            >
              {removingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            </button>
          </div>
        </div>
      ))}

      {pendingInvitations.map((inv) => (
        <div key={inv.id} className="flex items-center gap-3 p-3 bg-[#F5F0E8] border border-dashed border-[#E8E2D9] rounded-xl">
          <div className="w-8 h-8 rounded-full bg-white border border-[#E8E2D9] flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-[#9E9890]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#6B6560] truncate">{inv.email}</p>
            <p className="text-xs text-[#9E9890]">Invite pending · {inv.role.toLowerCase()}</p>
          </div>
          <button
            onClick={() => handleCancelInvite(inv.id)}
            className="text-[#9E9890] hover:text-[#B85C3A] transition-colors shrink-0"
            aria-label="Cancel invitation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      {total === 0 && !showInvite && (
        <p className="text-sm text-[#9E9890] text-center py-4">No collaborators yet.</p>
      )}

      {showInvite ? (
        <form onSubmit={handleInvite} className="bg-white border border-[#E8E2D9] rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-[#1C1C1A]">Invite someone</p>
          <Input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <div className="flex gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "EDITOR" | "VIEWER")}
              className="border border-[#E8E2D9] rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#2D5016]"
            >
              <option value="EDITOR">Editor — can plan &amp; edit</option>
              <option value="VIEWER">Viewer — read only</option>
            </select>
          </div>
          {error && <p className="text-xs text-[#B85C3A]">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={isInviting} className="bg-[#2D5016] hover:bg-[#4A7C2F] text-white">
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
            className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-[#E8E2D9] rounded-xl text-sm text-[#6B6560] hover:text-[#2D5016] hover:border-[#2D5016] transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Invite collaborator ({5 - total} remaining)
          </button>
        )
      )}
    </div>
  );
}
