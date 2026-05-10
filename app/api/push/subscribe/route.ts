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
