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
  /** SVG path data en coordonnées d'affichage (0..displayW × 0..displayH) */
  pathData: string;
  pointCount: number;
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
 * @param offsetPx    marge de coupe en pixels d'affichage
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

  // 2. Convertir offsetPx (display) → offsetMm (référence physique)
  //    Le service Python travaille en pixels d'image originale, on lui passe
  //    l'offset en mm. Pour ça, on fait l'hypothèse que la zone d'affichage
  //    représente la même surface physique que l'image. Le serveur convertit
  //    ensuite mm → px d'image originale via le DPI.
  //
  //    Ici on simplifie : on dérive offsetMm depuis le ratio d'affichage.
  //    Si displayW=240px représente la largeur en mm de l'image, alors
  //    1 mm display = 1 mm physique. On utilise directement le ratio.
  //    À défaut d'info précise, on envoie un DPI standard et offsetMm calculé
  //    pour produire un offset équivalent à offsetPx en display.
  //
  //    NB : la composante d'affichage repasse les coordonnées via scaleToDisplay()
  //    après réception. Donc l'unité ici n'a pas besoin d'être en mm physiques.
  const offsetMm = (offsetPx / Math.max(displayW, displayH)) * 30; // approximation

  const fd = new FormData();
  fd.append("file", blob, "image.png");
  fd.append("offset_mm", String(offsetMm.toFixed(2)));
  fd.append("dpi", "300");

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

  // 4. Rescaler les coordonnées vers l'espace d'affichage
  const { svg_path, width_px, height_px, point_count } = json.result;
  const sx = displayW / width_px;
  const sy = displayH / height_px;
  const pathData = scaleSvgPath(svg_path, sx, sy);

  return {
    ok: true,
    result: { pathData, pointCount: point_count },
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
    has_transparency: boolean;
    offset_px: number;
    offset_mm: number;
    dpi: number;
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

/** Rescale un SVG path linéaire (M/L) coordonnée par coordonnée. */
function scaleSvgPath(path: string, sx: number, sy: number): string {
  return path.replace(
    /([MLml])(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g,
    (_match, cmd: string, x: string, y: string) => {
      const px = (parseFloat(x) * sx).toFixed(1);
      const py = (parseFloat(y) * sy).toFixed(1);
      return `${cmd}${px},${py}`;
    },
  );
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
