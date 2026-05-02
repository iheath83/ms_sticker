/**
 * Wrapper côté serveur Next.js pour appeler le microservice Python `cutline-service`.
 *
 * Configuration via les variables d'env :
 * - `CUTLINE_SERVICE_URL` (ex : `http://cutline:8000` en réseau Docker interne)
 * - `CUTLINE_SERVICE_API_KEY` (Bearer token partagé)
 *
 * Toutes les routes API publiques passent par ce module — jamais directement
 * depuis le client (CORS + protection de la clé).
 */
import "server-only";

const SERVICE_URL = process.env.CUTLINE_SERVICE_URL ?? "http://cutline:8000";
const SERVICE_API_KEY = process.env.CUTLINE_SERVICE_API_KEY ?? "";

if (!SERVICE_API_KEY && process.env.NODE_ENV === "production") {
  console.warn(
    "[cutline-service] CUTLINE_SERVICE_API_KEY n'est pas défini. " +
      "Le service Python rejettera toutes les requêtes.",
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CutlineApiSuccess {
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

export interface CutlineApiFailure {
  ok: false;
  error: string;
  message?: string;
}

export type CutlineApiResponse = CutlineApiSuccess | CutlineApiFailure;

// ─── Cutline ──────────────────────────────────────────────────────────────────

export interface CutlineCallParams {
  file: Blob;
  filename?: string;
  /** Marge de coupe en pixels d'image originale (préféré, plus précis). */
  offsetPx?: number;
  /** Fallback si offsetPx absent : marge en mm + DPI. */
  offsetMm?: number;
  dpi?: number;
  closeRadiusPx?: number;
  smoothPasses?: number;
}

export async function callCutlineService(
  params: CutlineCallParams,
): Promise<CutlineApiResponse> {
  const fd = new FormData();
  fd.append("file", params.file, params.filename ?? "image.png");
  if (params.offsetPx !== undefined) {
    fd.append("offset_px", String(Math.round(params.offsetPx)));
  } else {
    fd.append("offset_mm", String(params.offsetMm ?? 2));
    fd.append("dpi", String(params.dpi ?? 300));
  }
  if (params.closeRadiusPx !== undefined) {
    fd.append("close_radius_px", String(params.closeRadiusPx));
  }
  if (params.smoothPasses !== undefined) {
    fd.append("smooth_passes", String(params.smoothPasses));
  }

  const res = await fetch(`${SERVICE_URL}/api/cutline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_API_KEY}` },
    body: fd,
    cache: "no-store",
  });

  const text = await res.text();
  let json: CutlineApiResponse;
  try {
    json = JSON.parse(text) as CutlineApiResponse;
  } catch {
    return {
      ok: false,
      error: "service_invalid_response",
      message: `Réponse non JSON (${res.status}) : ${text.slice(0, 200)}`,
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      error: "error" in json ? json.error : "service_error",
      message: "message" in json ? json.message : `HTTP ${res.status}`,
    };
  }
  return json;
}

// ─── Background removal ───────────────────────────────────────────────────────

/** Renvoie un PNG (binaire) avec fond transparent, ou `null` en cas d'erreur. */
export async function callBackgroundRemoveService(
  file: Blob,
  filename: string,
): Promise<{ ok: true; png: Blob } | { ok: false; error: string; message?: string }> {
  const fd = new FormData();
  fd.append("file", file, filename);

  const res = await fetch(`${SERVICE_URL}/api/background/remove`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_API_KEY}` },
    body: fd,
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const errorJson = (await res.json()) as { error?: string; message?: string };
      message = errorJson.message ?? errorJson.error ?? message;
    } catch {
      // ignore
    }
    return { ok: false, error: "service_error", message };
  }

  const png = await res.blob();
  return { ok: true, png };
}
