"use client";
import { useState, useTransition, useRef } from "react";
import { uploadPhoto, deletePhoto } from "@/app/actions/tracking";
import { Camera, Trash2, Loader2, Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type Photo = {
  id: string;
  url: string;
  caption: string | null;
  takenAt: Date;
};

type Props = {
  plantingId: string;
  photos: Photo[];
  isPro: boolean;
};

const FREE_LIMIT = 20;

export function PhotoGallery({ plantingId, photos, isPro }: Props) {
  const [isUploading, startUpload] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startDelete] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    startUpload(async () => {
      await uploadPhoto(plantingId, formData);
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    startDelete(async () => {
      await deletePhoto(id);
      setDeletingId(null);
    });
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg font-semibold text-[#111109]">Photos</h2>
        <span className="text-xs text-[#ADADAA]">
          {photos.length}{!isPro ? `/${FREE_LIMIT}` : ""} photo{photos.length !== 1 ? "s" : ""}
        </span>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group aspect-square rounded-xl overflow-hidden bg-[#F4F4EC]">
              <Image
                src={photo.url}
                alt={photo.caption ?? "Garden photo"}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 33vw, 200px"
              />
              {photo.caption && (
                <div className="absolute bottom-0 inset-x-0 bg-black/40 px-2 py-1">
                  <p className="text-[10px] text-white truncate">{photo.caption}</p>
                </div>
              )}
              <button
                onClick={() => handleDelete(photo.id)}
                disabled={deletingId === photo.id}
                className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              >
                {deletingId === photo.id ? (
                  <Loader2 className="w-3 h-3 text-white animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3 text-white" />
                )}
              </button>
              <p className="absolute bottom-0 left-0 text-[9px] text-white/70 px-1.5 py-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                {new Date(photo.takenAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
          ))}
        </div>
      )}

      {!isPro && photos.length >= FREE_LIMIT ? (
        <div className="flex items-center gap-2 text-sm text-[#ADADAA]">
          <Lock className="w-4 h-4" />
          <span>
            Photo limit reached.{" "}
            <Link href="/settings/billing" className="text-[#D4820A] hover:underline">
              Upgrade to Pro
            </Link>{" "}
            for unlimited photos.
          </span>
        </div>
      ) : (
        <label className={`flex items-center gap-2 text-sm font-medium cursor-pointer transition-colors ${
          isUploading ? "text-[#ADADAA]" : "text-[#7DA84E] hover:text-[#1C3D0A]"
        }`}>
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Camera className="w-4 h-4" />
          )}
          {isUploading ? "Uploading…" : "Add photo"}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      )}
    </section>
  );
}
