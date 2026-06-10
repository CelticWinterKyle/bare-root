import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const parsed = subscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return new Response("Invalid subscription", { status: 400 });
  }

  const { endpoint, keys } = parsed.data;

  await db.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId,
      endpoint,
      p256dhKey: keys.p256dh,
      authKey: keys.auth,
    },
    update: {
      userId,
      p256dhKey: keys.p256dh,
      authKey: keys.auth,
    },
  });

  return new Response("OK", { status: 201 });
}

const deleteSchema = z.object({
  endpoint: z.string().url(),
});

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return new Response("Invalid body", { status: 400 });
  }

  // deleteMany scoped to the session user: deleting someone else's (or an
  // unknown) endpoint is a silent no-op rather than an error.
  await db.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, userId },
  });

  return Response.json({ ok: true });
}
