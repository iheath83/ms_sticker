// Pure utility functions — no DB imports, safe to use in Client Components

/**
 * Maps a DB material string to a StickerMaterial type used in StickerPreview.
 */
export function materialToPreview(
  material: string,
): "vinyl" | "holographic" | "glitter" | "transparent" | "kraft" {
  const map: Record<string, "vinyl" | "holographic" | "glitter" | "transparent" | "kraft"> = {
    vinyl:        "vinyl",
    holographic:  "holographic",
    glitter:      "glitter",
    transparent:  "transparent",
    kraft:        "kraft",
  };
  return map[material] ?? "vinyl";
}

/** Cents → euros string, no decimals (rounded) */
export function formatPriceCents(cents: number): string {
  return String(Math.round(cents / 100));
}
