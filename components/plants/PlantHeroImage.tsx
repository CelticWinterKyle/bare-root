"use client";
import { useState } from "react";
import Image from "next/image";

const CATEGORY_GRADIENT: Record<string, string> = {
  VEGETABLE: "linear-gradient(135deg, #1B4A0A 0%, #3A6B20 100%)",
  FRUIT:     "linear-gradient(135deg, #3A1A08 0%, #7A2A18 100%)",
  HERB:      "linear-gradient(135deg, #283010 0%, #4A5A20 100%)",
  FLOWER:    "linear-gradient(135deg, #2A2A30 0%, #5A4A6A 100%)",
  TREE:      "linear-gradient(135deg, #1C2A10 0%, #2D4A1A 100%)",
  SHRUB:     "linear-gradient(135deg, #1A2A15 0%, #3A5A20 100%)",
  OTHER:     "linear-gradient(135deg, #2A2A20 0%, #4A4A38 100%)",
};

export function PlantHeroImage({
  imageUrl,
  name,
  category,
}: {
  imageUrl: string | null;
  name: string;
  category: string;
}) {
  const [failed, setFailed] = useState(false);
  const gradient = CATEGORY_GRADIENT[category] ?? CATEGORY_GRADIENT.OTHER;

  return (
    <div
      className="aspect-[16/7] relative overflow-hidden rounded-t-2xl flex items-center justify-center"
      style={{ background: gradient }}
    >
      {imageUrl && !failed ? (
        <Image
          src={imageUrl}
          alt={name}
          fill
          unoptimized
          className="object-cover"
          sizes="768px"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="select-none pointer-events-none"
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontWeight: 800,
            color: "white",
            opacity: 0.1,
            fontSize: "clamp(80px, 18vw, 140px)",
          }}
        >
          {name[0].toUpperCase()}
        </span>
      )}
    </div>
  );
}
