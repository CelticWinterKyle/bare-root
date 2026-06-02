import { requireUser } from "@/lib/auth";
import { resolveActiveGardenId } from "@/lib/active-garden";
import { redirect } from "next/navigation";

export default async function GardenIndexPage() {
  const user = await requireUser();

  const gardenId = await resolveActiveGardenId(user.id);

  if (gardenId) redirect(`/garden/${gardenId}`);
  redirect("/dashboard");
}
