import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { acceptInvitation } from "@/app/actions/collaborators";
import { Sprout } from "lucide-react";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  await requireUser();

  const invitation = await db.gardenInvitation.findUnique({
    where: { token },
    include: { garden: { select: { name: true, user: { select: { name: true } } } } },
  });

  if (!invitation) notFound();

  if (invitation.acceptedAt) {
    redirect(`/garden/${invitation.gardenId}`);
  }

  const expired = invitation.expiresAt < new Date();

  async function accept() {
    "use server";
    const { gardenId } = await acceptInvitation(token);
    redirect(`/garden/${gardenId}`);
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-white rounded-2xl border border-[#E4E4DC] p-8 text-center">
        <div className="w-12 h-12 bg-[#F4F4EC] rounded-xl flex items-center justify-center mx-auto mb-4">
          <Sprout className="w-6 h-6 text-[#1C3D0A]" />
        </div>

        {expired ? (
          <>
            <h1 className="font-display text-xl font-semibold text-[#111109] mb-2">
              Invitation expired
            </h1>
            <p className="text-sm text-[#6B6B5A]">
              This invitation to <strong>{invitation.garden.name}</strong> has expired.
              Ask the garden owner to send a new one.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-xl font-semibold text-[#111109] mb-2">
              Garden invitation
            </h1>
            <p className="text-sm text-[#6B6B5A] mb-6">
              <strong>{invitation.garden.user.name ?? "Someone"}</strong> invited you to
              collaborate on <strong>{invitation.garden.name}</strong> as a{" "}
              {invitation.role.toLowerCase()}.
            </p>
            <form action={accept}>
              <button
                type="submit"
                className="w-full bg-[#1C3D0A] hover:bg-[#3A6B20] text-white font-medium py-3 rounded-xl transition-colors text-sm"
              >
                Accept invitation
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
