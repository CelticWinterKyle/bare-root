"use client";
import { PlantThumb } from "@/components/plants/PlantThumb";

export function PlantHeroImage({
  imageUrl,
  name,
  category,
}: {
  imageUrl: string | null;
  name: string;
  category: string;
}) {
  return (
    <div
      className="aspect-[16/7] relative overflow-hidden rounded-t-2xl flex items-center justify-center"
      style={{ background: "#F4F4EC" }}
    >
      <PlantThumb src={imageUrl} category={category} name={name} />
    </div>
  );
}
