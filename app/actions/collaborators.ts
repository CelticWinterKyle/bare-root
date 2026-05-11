"use server";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { CollabRole } from "@/lib/generated/prisma/enums";
import { sendReminderEmail } from "@/lib/api/email";
import { randomBytes } from "crypto";

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function buildInviteEmailHtml(
  gardenName: string,
  inviterName: string,
  role: string,
  acceptUrl: string
): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;background:#FAF7F2;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #E8E2D9;">
    <p style="font-size:22px;font-weight:600;color:#1C1C1A;margin:0 0 8px">You've been invited to a garden</p>
    <p style="color:#6B6560;font-size:15px;margin:0 0 24px">
      ${inviterName} invited you to collaborate on <strong>${gardenName}</strong> as a ${role.toLowerCase()}.
    </p>
    <a href="${acceptUrl}" style="display:inline-block;background:#2D5016;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500">Accept invitation →</a>
    <p style="margin-top:24px;font-size:12px;color:#9E9890">This invitation expires in 7 days. If you don't have a Bare Root account yet, you'll be asked to create one first.</p>
  </div>
</body>
</html>`;
}

export async function inviteCollaborator(gardenId: string, email: string, role: CollabRole) {
  const user = await requireUser();

  if (user.subscriptionTier !== "PRO") {
    throw new Error("UPGRADE_REQUIRED");
  }

  const garden = await db.garden.findFirst({
    where: { id: gardenId, userId: user.id },
    select: { name: true },
  });
  if (!garden) throw new Error("Garden not found");

  // Check collaborator limit (5 per garden)
  const existingCount = await db.gardenCollaborator.count({ where: { gardenId } });
  if (existingCount >= 5) throw new Error("COLLABORATOR_LIMIT_REACHED");

  // Can't invite yourself
  if (email.toLowerCase() === user.email.toLowerCase()) throw new Error("CANNOT_INVITE_SELF");

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // If invitee already has an account, add them directly
  const existingUser = await db.user.findUnique({ where: { email: email.toLowerCase() } });

  if (existingUser) {
    await db.gardenCollaborator.upsert({
      where: { gardenId_userId: { gardenId, userId: existingUser.id } },
      create: { gardenId, userId: existingUser.id, role, acceptedAt: new Date() },
      update: { role, acceptedAt: new Date() },
    });
  } else {
    await db.gardenInvitation.upsert({
      where: { gardenId_email: { gardenId, email: email.toLowerCase() } },
      create: { gardenId, email: email.toLowerCase(), role, token, expiresAt },
      update: { role, token, expiresAt, acceptedAt: null },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const html = buildInviteEmailHtml(
      garden.name,
      user.name ?? user.email,
      role,
      `${appUrl}/invite/${token}`
    );
    await sendReminderEmail(email, `You're invited to ${garden.name} on Bare Root`, html);
  }

  revalidatePath(`/garden/${gardenId}/settings`);
}

export async function removeCollaborator(gardenId: string, collaboratorUserId: string) {
  const user = await requireUser();

  const garden = await db.garden.findFirst({ where: { id: gardenId, userId: user.id } });
  if (!garden) throw new Error("Garden not found");

  await db.gardenCollaborator.deleteMany({
    where: { gardenId, userId: collaboratorUserId },
  });

  revalidatePath(`/garden/${gardenId}/settings`);
}

export async function updateCollaboratorRole(
  gardenId: string,
  collaboratorUserId: string,
  role: CollabRole
) {
  const user = await requireUser();

  const garden = await db.garden.findFirst({ where: { id: gardenId, userId: user.id } });
  if (!garden) throw new Error("Garden not found");

  await db.gardenCollaborator.update({
    where: { gardenId_userId: { gardenId, userId: collaboratorUserId } },
    data: { role },
  });

  revalidatePath(`/garden/${gardenId}/settings`);
}

export async function cancelInvitation(gardenId: string, invitationId: string) {
  const user = await requireUser();

  const garden = await db.garden.findFirst({ where: { id: gardenId, userId: user.id } });
  if (!garden) throw new Error("Garden not found");

  await db.gardenInvitation.delete({ where: { id: invitationId } });
  revalidatePath(`/garden/${gardenId}/settings`);
}

export async function acceptInvitation(token: string): Promise<{ gardenId: string }> {
  const user = await requireUser();

  const invitation = await db.gardenInvitation.findUnique({ where: { token } });

  if (!invitation) throw new Error("INVALID_TOKEN");
  if (invitation.expiresAt < new Date()) throw new Error("EXPIRED");
  if (invitation.acceptedAt) throw new Error("ALREADY_ACCEPTED");

  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error("EMAIL_MISMATCH");
  }

  await db.$transaction([
    db.gardenCollaborator.upsert({
      where: { gardenId_userId: { gardenId: invitation.gardenId, userId: user.id } },
      create: {
        gardenId: invitation.gardenId,
        userId: user.id,
        role: invitation.role,
        acceptedAt: new Date(),
      },
      update: { role: invitation.role, acceptedAt: new Date() },
    }),
    db.gardenInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  return { gardenId: invitation.gardenId };
}
