export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Phase 5: check WeatherCache for frost in next 72h, create FROST_ALERT reminders
  return Response.json({ ok: true });
}
