/**
 * Client browser pour la génération de ligne de coupe.
 *
 * Délègue tout le calcul au service Python (FastAPI + OpenCV) via l'API
 * Next.js `/api/sticker-editor/cutline`. Retourne un SVG path en
 * coordonnées d'affichage (relatives à l'image), prêt à être consommé
 * par Konva.
 *
 * Si l'image fournie est un blob URL ou un data URL, on la fetch d'abord
 * pour obtenir un Blob, puis on l'envoie en multipart/form-data.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CutlineResult {
  /** SVG path data en coordonnées d'image originale (0..imageWidthPx × 0..imageHeightPx).
   *  Le rendu doit appliquer un scale pour adapter à la taille d'affichage. */
  pathData: string;
  pointCount: number;
  imageWidthPx: number;
  imageHeightPx: number;
}

export type CutlineError =
  | "no_transparency"
  | "no_contour"
  | "load_failed"
  | "service_unavailable"
  | "rate_limited"
  | "file_too_large";

export interface CutlineSuccess {
  ok: true;
  result: CutlineResult;
}
export interface CutlineFailure {
  ok: false;
  error: CutlineError;
  message: string;
}
export type CutlineOutcome = CutlineSuccess | CutlineFailure;

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * Génère un SVG path de découpe à la forme depuis le canal alpha d'une image.
 *
 * @param imageUrl    URL de l'image (data URL, blob URL ou URL publique)
 * @param displayW    largeur d'affichage en pixels (canvas)
 * @param displayH    hauteur d'affichage en pixels (canvas)
 * @param offsetPx    marge de coupe en pixels d'affichage. Convertie en
 *                    pixels d'image originale via le ratio displayW / imageWidthPx.
 */
export async function generateAlphaCutline(
  imageUrl: string,
  displayW: number,
  displayH: number,
  offsetPx: number,
): Promise<CutlineOutcome> {
  // 1. Récupérer le Blob de l'image
  let blob: Blob;
  try {
    const r = await fetch(imageUrl);
    if (!r.ok) throw new Error(`fetch failed ${r.status}`);
    blob = await r.blob();
  } catch {
    return {
      ok: false,
      error: "load_failed",
      message: "Impossible de charger l'image.",
    };
  }

  // 2. Lire les dimensions natives de l'image pour convertir offsetPx
  //    (pixels d'affichage) → pixels d'image originale (= unité de travail
  //    du backend). Cette conversion est exacte et indépendante du DPI.
  const imgDims = await getImageNaturalSize(blob);
  if (!imgDims) {
    return {
      ok: false,
      error: "load_failed",
      message: "Impossible de lire les dimensions de l'image.",
    };
  }
  const displayMax = Math.max(displayW, displayH, 1);
  const imageMax = Math.max(imgDims.width, imgDims.height, 1);
  const offsetImagePx = (offsetPx * imageMax) / displayMax;

  const fd = new FormData();
  fd.append("file", blob, "image.png");
  fd.append("offset_px", String(Math.round(offsetImagePx)));

  // 3. Appel API
  let res: Response;
  try {
    res = await fetch("/api/sticker-editor/cutline", {
      method: "POST",
      body: fd,
    });
  } catch {
    return {
      ok: false,
      error: "service_unavailable",
      message: "Service de contour temporairement indisponible.",
    };
  }

  if (res.status === 429) {
    return {
      ok: false,
      error: "rate_limited",
      message: "Trop de requêtes, réessayez dans quelques minutes.",
    };
  }
  if (res.status === 413) {
    return {
      ok: false,
      error: "file_too_large",
      message: "Fichier trop volumineux (max 25 Mo).",
    };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return {
      ok: false,
      error: "service_unavailable",
      message: `Réponse invalide (HTTP ${res.status}).`,
    };
  }

  if (!isApiResponse(json)) {
    return {
      ok: false,
      error: "service_unavailable",
      message: "Réponse de format inattendu.",
    };
  }

  if (!json.ok) {
    return {
      ok: false,
      error: mapServerError(json.error),
      message: json.message ?? "Erreur lors de la génération du contour.",
    };
  }

  // 4. Le path est retourné en coordonnées d'image originale (px).
  //    Le rendu Konva applique scaleX/Y pour s'adapter à la taille d'affichage,
  //    ce qui évite tout décalage si plusieurs scales sont en jeu (canvas
  //    interne vs zone d'affichage).
  const { svg_path, width_px, height_px, point_count } = json.result;
  return {
    ok: true,
    result: {
      pathData: svg_path,
      pointCount: point_count,
      imageWidthPx: width_px,
      imageHeightPx: height_px,
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface ServerSuccess {
  ok: true;
  result: {
    svg_path: string;
    width_px: number;
    height_px: number;
    point_count: number;
    contour_count: number;
    has_transparency: boolean;
    offset_px: number;
  };
}
interface ServerFailure {
  ok: false;
  error: string;
  message?: string;
}

function isApiResponse(v: unknown): v is ServerSuccess | ServerFailure {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.ok !== "boolean") return false;
  if (r.ok && r.result && typeof r.result === "object") return true;
  if (!r.ok && typeof r.error === "string") return true;
  return false;
}

function mapServerError(err: string): CutlineError {
  switch (err) {
    case "no_transparency":
    case "no_contour":
    case "load_failed":
    case "rate_limited":
    case "file_too_large":
      return err;
    default:
      return "service_unavailable";
  }
}

/** Lit les dimensions naturelles d'une image depuis un Blob. */
async function getImageNaturalSize(
  blob: Blob,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

// ─── Suppression de fond ─────────────────────────────────────────────────────

export interface BgRemoveSuccess {
  ok: true;
  /** Object URL du PNG résultant — penser à le révoquer après usage */
  url: string;
  blob: Blob;
}
export interface BgRemoveFailure {
  ok: false;
  error: CutlineError;
  message: string;
}
export type BgRemoveOutcome = BgRemoveSuccess | BgRemoveFailure;

/**
 * Supprime le fond d'une image (rembg côté serveur).
 * Retourne un objet URL prêt à être affiché.
 */
export async function removeBackground(
  imageUrl: string,
): Promise<BgRemoveOutcome> {
  let blob: Blob;
  try {
    const r = await fetch(imageUrl);
    if (!r.ok) throw new Error(`fetch failed ${r.status}`);
    blob = await r.blob();
  } catch {
    return {
      ok: false,
      error: "load_failed",
      message: "Impossible de charger l'image.",
    };
  }

  const fd = new FormData();
  fd.append("file", blob, "image.png");

  let res: Response;
  try {
    res = await fetch("/api/sticker-editor/background-remove", {
      method: "POST",
      body: fd,
    });
  } catch {
    return {
      ok: false,
      error: "service_unavailable",
      message: "Service de suppression de fond temporairement indisponible.",
    };
  }

  if (res.status === 429) {
    return {
      ok: false,
      error: "rate_limited",
      message: "Trop de requêtes, réessayez dans quelques minutes.",
    };
  }
  if (res.status === 413) {
    return {
      ok: false,
      error: "file_too_large",
      message: "Fichier trop volumineux (max 25 Mo).",
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      error: "service_unavailable",
      message: `Erreur (HTTP ${res.status})`,
    };
  }

  const png = await res.blob();
  return {
    ok: true,
    blob: png,
    url: URL.createObjectURL(png),
  };
}
