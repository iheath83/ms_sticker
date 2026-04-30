"use client";

import { useState } from "react";
import Image from "next/image";
import type { ReviewMediaRow } from "@/lib/reviews/review-types";

interface ReviewMediaGalleryProps {
  media: ReviewMediaRow[];
}

export function ReviewMediaGallery({ media }: ReviewMediaGalleryProps) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (media.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-3">
        {media.map((m) => (
          <button
            key={m.id}
            onClick={() => setLightbox(m.url)}
            className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-100 hover:opacity-90 transition"
          >
            <Image
              src={m.thumbnailUrl ?? m.url}
              alt={m.altText ?? "Photo avis"}
              fill
              className="object-cover"
            />
          </button>
        ))}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-2xl max-h-[80vh] w-full">
            <Image
              src={lightbox}
              alt="Agrandissement"
              width={800}
              height={600}
              className="rounded-xl object-contain w-full h-auto max-h-[80vh]"
            />
          </div>
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white text-2xl"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
