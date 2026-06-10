import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { acceptInvitation } from "@/app/actions/collaborators";
import { Sprout } from "lucide-react";

const ROLE_COPY: Record<string, string> = {
  EDITOR:
    "As an editor you can plant, log harvests, and leave notes — a full pair of hands in the beds.",
  VIEWER:
    "As a viewer you can watch the garden grow — browse the beds, the plantings, and the journal.",
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await requireUser();

  const invitation = await db.gardenInvitation.findUnique({
    where: { token },
    include: { garden: { select: { name: true, user: { select: { name: true } } } } },
  });

  if (!invitation) notFound();

  if (invitation.acceptedAt) {
    redirect(`/garden/${invitation.gardenId}`);
  }

  const expired = invitation.expiresAt < new Date();
  const mismatch =
    !expired && invitation.email.toLowerCase() !== user.email.toLowerCase();
  const inviterName = invitation.garden.user.name ?? "The garden owner";

  async function accept() {
    "use server";
    const { gardenId } = await acceptInvitation(token);
    redirect(`/garden/${gardenId}`);
  }

  return (
    <div className="min-h-screen bg-[#FDFDF8] flex items-center justify-center px-4 py-12">
      <div className="max-w-sm w-full animate-fade-rise">
        <div
          className="bg-white rounded-2xl border border-[#E4E4DC] overflow-hidden"
          style={{ boxShadow: "0 2px 16px rgba(28,61,10,0.06)" }}
        >
          {/* Botanical header band */}
          <div
            className="px-8 pt-8 pb-6 text-center"
            style={{ background: "#F4F4EC", borderBottom: "1px solid #E4E4DC" }}
          >
            <div className="w-12 h-12 bg-[#E4F0D4] rounded-full flex items-center justify-center mx-auto mb-4">
              <Sprout className="w-6 h-6 text-[#1C3D0A]" />
            </div>
            <div
              className="flex items-center justify-center gap-1.5"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#7DA84E",
              }}
            >
              <span style={{ display: "block", width: "16px", height: "1.5px", background: "#7DA84E", borderRadius: "1px", flexShrink: 0 }} />
              You&rsquo;re invited
              <span style={{ display: "block", width: "16px", height: "1.5px", background: "#7DA84E", borderRadius: "1px", flexShrink: 0 }} />
            </div>
          </div>

          <div className="px-8 py-7 text-center">
            {expired ? (
              <>
                <h1
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "24px",
                    fontWeight: 800,
                    color: "#111109",
                    letterSpacing: "-0.025em",
                    lineHeight: 1.15,
                    fontVariationSettings: "'opsz' 26",
                    marginBottom: "10px",
                  }}
                >
                  This invitation has <em style={{ fontStyle: "italic", color: "#1C3D0A" }}>wilted</em>.
                </h1>
                <p className="text-sm text-[#6B6B5A] leading-relaxed">
                  The invite to <strong className="text-[#111109]">{invitation.garden.name}</strong>{" "}
                  expired before it was accepted. Ask {inviterName} to send a
                  fresh one — they only take a moment.
                </p>
              </>
            ) : mismatch ? (
              <>
                <h1
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "24px",
                    fontWeight: 800,
                    color: "#111109",
                    letterSpacing: "-0.025em",
                    lineHeight: 1.15,
                    fontVariationSettings: "'opsz' 26",
                    marginBottom: "10px",
                  }}
                >
                  Right invite, <em style={{ fontStyle: "italic", color: "#1C3D0A" }}>different door</em>.
                </h1>
                <p className="text-sm text-[#6B6B5A] leading-relaxed">
                  This invitation to <strong className="text-[#111109]">{invitation.garden.name}</strong>{" "}
                  was sent to <strong className="text-[#111109]">{invitation.email}</strong>, but
                  you&rsquo;re signed in as {user.email}. Sign in with the
                  invited address to accept it.
                </p>
              </>
            ) : (
              <>
                <h1
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "26px",
                    fontWeight: 800,
                    color: "#111109",
                    letterSpacing: "-0.025em",
                    lineHeight: 1.15,
                    fontVariationSettings: "'opsz' 28",
                    marginBottom: "10px",
                  }}
                >
                  Join <em style={{ fontStyle: "italic", color: "#1C3D0A" }}>{invitation.garden.name}</em>
                </h1>
                <p className="text-sm text-[#6B6B5A] leading-relaxed mb-2">
                  <strong className="text-[#111109]">{inviterName}</strong> wants
                  you in the garden.
                </p>
                <p className="text-sm text-[#6B6B5A] leading-relaxed mb-7">
                  {ROLE_COPY[invitation.role] ?? ROLE_COPY.VIEWER}
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

        <p
          className="text-center mt-5"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#ADADAA",
          }}
        >
          Bare Root · Garden planning
        </p>
      </div>
    </div>
  );
}
