"use client";
import { useState } from "react";
import Image from "next/image";


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

  return (
    <div
      className="aspect-[16/7] relative overflow-hidden rounded-t-2xl flex items-center justify-center"
      style={{ background: "#F4F4EC" }}
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
            color: "#111109",
            opacity: 0.07,
            fontSize: "clamp(80px, 18vw, 140px)",
          }}
        >
          {name[0].toUpperCase()}
        </span>
      )}
    </div>
  );
}
