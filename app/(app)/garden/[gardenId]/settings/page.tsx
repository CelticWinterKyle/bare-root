import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Lock } from "lucide-react";
import { CollaboratorsClient } from "@/components/collaborators/CollaboratorsClient";

export default async function GardenSettingsPage({
  params,
}: {
  params: Promise<{ gardenId: string }>;
}) {
  const { gardenId } = await params;
  const user = await requireUser();

  const garden = await db.garden.findFirst({
    where: { id: gardenId, userId: user.id },
    include: {
      collaborators: {
        where: { acceptedAt: { not: null } },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        orderBy: { acceptedAt: "asc" },
      },
      invitations: {
        where: { acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { invitedAt: "desc" },
      },
    },
  });

  if (!garden) notFound();

  const isPro = user.subscriptionTier === "PRO";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href={`/garden/${gardenId}`}
        className="inline-flex items-center gap-1 text-sm text-[#6B6B5A] hover:text-[#1C3D0A] mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        {garden.name}
      </Link>

      <h1 className="font-display text-2xl font-semibold text-[#111109] mb-8">Garden settings</h1>

      {/* Collaborators */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-medium text-[#111109]">Collaborators</h2>
            <p className="text-xs text-[#ADADAA] mt-0.5">Share this garden with others</p>
          </div>
          {!isPro && (
            <Link
              href="/settings/billing"
              className="flex items-center gap-1 text-xs text-[#D4820A] font-medium hover:underline"
            >
              <Lock className="w-3 h-3" />
              Pro feature
            </Link>
          )}
        </div>

        {!isPro ? (
          <div className="bg-[#F4F4EC] rounded-xl border border-dashed border-[#E4E4DC] p-6 text-center">
            <Lock className="w-6 h-6 text-[#ADADAA] mx-auto mb-2" />
            <p className="text-sm font-medium text-[#111109] mb-1">Collaborators are a Pro feature</p>
            <p className="text-xs text-[#ADADAA] mb-3">Invite up to 5 people to plan together.</p>
            <Link
              href="/settings/billing"
              className="text-sm font-medium text-[#D4820A] hover:underline"
            >
              Upgrade to Pro
            </Link>
          </div>
        ) : (
          <CollaboratorsClient
            gardenId={gardenId}
            collaborators={garden.collaborators.map((c) => ({
              id: c.id,
              userId: c.user.id,
              name: c.user.name,
              email: c.user.email,
              avatarUrl: c.user.avatarUrl,
              role: c.role,
            }))}
            pendingInvitations={garden.invitations.map((inv) => ({
              id: inv.id,
              email: inv.email,
              role: inv.role,
              expiresAt: inv.expiresAt.toISOString(),
            }))}
          />
        )}
      </section>
    </div>
  );
}
