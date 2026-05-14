import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenAccessFilter } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function GardenIndexPage() {
  const user = await requireUser();

  const garden = await db.garden.findFirst({
    where: gardenAccessFilter(user.id),
    orderBy: { createdAt: "asc" },
  });

  if (garden) redirect(`/garden/${garden.id}`);
  redirect("/dashboard");
}
