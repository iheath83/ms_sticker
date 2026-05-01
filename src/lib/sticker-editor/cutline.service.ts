/**
 * Génération de ligne de coupe globale (kiss cut) depuis le canal alpha.
 *
 * Objectif : UN SEUL contour qui fait le tour de toute la forme, pas une
 * découpe lettre par lettre. Adapté aux stickers kiss cut sur planche.
 *
 * Pipeline :
 *  1. Canvas offscreen BASSE résolution (80×80) — intentionnel pour obtenir
 *     un contour global sans détail de lettres
 *  2. Masque binaire alpha
 *  3. Fermeture morphologique par CONNECT_RADIUS :
 *       dilate(r) puis erode(r)
 *       → soude les parties disjointes (emblem + texte) sans modifier la taille
 *       → remplit les trous inter-éléments
 *  4. Marching squares → UN polygone extérieur
 *  5. Douglas-Peucker (tolérance haute = courbe lisse)
 *  6. Mise à l'échelle vers la taille d'affichage
 *  7. Offset polygonal bevel join en display px
 *  8. Lissage
 */

interface Point { x: number; y: number; }

// ─── Paramètres ───────────────────────────────────────────────────────────────

/** Résolution volontairement basse pour un contour global. */
const GRID_SIZE       = 80;
const ALPHA_THRESHOLD = 15;
/**
 * Rayon de fermeture morphologique (grid px).
 * Valeur 5 → comble les vides jusqu'à 10 px grille (~12 % du GRID_SIZE).
 * En espace affichage ≈ 10 × displayW/80 → ~75 px, suffisant pour
 * souder l'emblem MS et le texte ADHÉSIF en une seule silhouette.
 */
const CONNECT_RADIUS      = 5;
const SIMPLIFY_TOLERANCE  = 1.5;  // haute tolérance → courbe plus lisse
const SMOOTH_PASSES       = 3;    // plusieurs passes → arrondi kiss-cut
const BEVEL_THRESHOLD     = 1.4;  // bevel join si miter > 1.4 × dist

// ─── API publique ─────────────────────────────────────────────────────────────

export interface CutlineResult { pathData: string; pointCount: number; }
export type CutlineError = "no_transparency" | "no_contour" | "load_failed";
export interface CutlineSuccess { ok: true; result: CutlineResult; }
export interface CutlineFailure { ok: false; error: CutlineError; message: string; }
export type CutlineOutcome = CutlineSuccess | CutlineFailure;

export async function generateAlphaCutline(
  imageUrl: string,
  displayW: number,
  displayH: number,
  offsetPx: number,
): Promise<CutlineOutcome> {

  // 1. Charger l'image
  let img: HTMLImageElement;
  try { img = await loadImageElement(imageUrl); }
  catch { return { ok: false, error: "load_failed", message: "Impossible de charger l'image." }; }

  // 2. Canvas offscreen basse résolution
  const canvas = document.createElement("canvas");
  canvas.width = GRID_SIZE; canvas.height = GRID_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, error: "no_contour", message: "Canvas non disponible." };
  ctx.drawImage(img, 0, 0, GRID_SIZE, GRID_SIZE);

  // 3. Masque binaire
  const { data } = ctx.getImageData(0, 0, GRID_SIZE, GRID_SIZE);
  const mask = new Uint8Array(GRID_SIZE * GRID_SIZE) as Uint8Array<ArrayBuffer>;
  let opaquePixels = 0;
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    const alpha = data[i * 4 + 3] ?? 0;
    if (alpha > ALPHA_THRESHOLD) { mask[i] = 1; opaquePixels++; }
  }

  const fraction = opaquePixels / (GRID_SIZE * GRID_SIZE);
  if (fraction > 0.96) {
    return {
      ok: false, error: "no_transparency",
      message: "Votre image n'a pas de fond transparent. Utilisez un PNG avec canal alpha pour la découpe à la forme.",
    };
  }

  // 4. Fermeture morphologique : dilate puis erode (même rayon)
  //    → soude les éléments proches, bouche les trous, UN seul blob
  const dilated = morphSep(mask,    GRID_SIZE, GRID_SIZE, CONNECT_RADIUS, "dilate");
  const closed  = morphSep(dilated, GRID_SIZE, GRID_SIZE, CONNECT_RADIUS, "erode");

  // 5. Marching squares → segments
  const segments = marchingSquares(closed, GRID_SIZE, GRID_SIZE);
  if (!segments.length) {
    return { ok: false, error: "no_contour", message: "Aucun contour détecté." };
  }

  // 6. Connexion → polygones
  const polygons = connectSegments(segments);
  if (!polygons.length) {
    return { ok: false, error: "no_contour", message: "Impossible de construire le contour." };
  }

  // 7. Prendre le plus grand polygone (contour extérieur global)
  const raw = [...polygons].sort((a, b) => polygonArea(b) - polygonArea(a))[0] ?? [];
  if (raw.length < 4) {
    return { ok: false, error: "no_contour", message: "Contour trop petit." };
  }

  // 8. Douglas-Peucker
  const simplified = douglasPeucker(raw, SIMPLIFY_TOLERANCE);

  // 9. Mise à l'échelle vers la taille d'affichage
  const sx = displayW / GRID_SIZE, sy = displayH / GRID_SIZE;
  const scaled = simplified.map((p) => ({ x: p.x * sx, y: p.y * sy }));

  // 10. Offset polygonal (bevel join) en display px
  const expanded = offsetPx > 0 ? normalBevelOffset(scaled, offsetPx) : scaled;

  // 11. Lissage
  const smoothed = smoothPolygon(expanded, SMOOTH_PASSES);

  const pathData = toSvgPath(smoothed);
  return { ok: true, result: { pathData, pointCount: smoothed.length } };
}

// ─── Chargement image ─────────────────────────────────────────────────────────

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error("load_failed"));
    img.src = url;
  });
}

// ─── Morphologie séparable (dilate / erode) ───────────────────────────────────

function morphSep(
  src: Uint8Array, w: number, h: number, r: number, op: "dilate" | "erode",
): Uint8Array {
  const isDilate = op === "dilate";

  // Passe horizontale
  const tmp = new Uint8Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
      let val = isDilate ? 0 : 1;
      for (let nx = x0; nx <= x1; nx++) {
        const px = src[y * w + nx] ?? 0;
        if (isDilate) { if (px === 1) { val = 1; break; } }
        else          { if (px !== 1) { val = 0; break; } }
      }
      tmp[y * w + x] = val;
    }
  }

  // Passe verticale
  const out = new Uint8Array(src.length) as Uint8Array<ArrayBuffer>;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
      let val = isDilate ? 0 : 1;
      for (let ny = y0; ny <= y1; ny++) {
        const px = tmp[ny * w + x] ?? 0;
        if (isDilate) { if (px === 1) { val = 1; break; } }
        else          { if (px !== 1) { val = 0; break; } }
      }
      out[y * w + x] = val;
    }
  }
  return out;
}

// ─── Marching squares ─────────────────────────────────────────────────────────

const MS_TABLE: [0 | 1 | 2 | 3, 0 | 1 | 2 | 3][][] = [
  [], [[3,2]], [[2,1]], [[3,1]],
  [[0,1]], [[3,0],[1,2]], [[0,2]], [[3,0]],
  [[0,3]], [[0,2]], [[0,1],[3,2]], [[0,1]],
  [[3,1]], [[2,1]], [[3,2]], [],
];

function edgeMid(cx: number, cy: number, edge: 0 | 1 | 2 | 3): Point {
  switch (edge) {
    case 0: return { x: cx + 0.5, y: cy };
    case 1: return { x: cx + 1,   y: cy + 0.5 };
    case 2: return { x: cx + 0.5, y: cy + 1 };
    case 3: return { x: cx,       y: cy + 0.5 };
  }
}

function marchingSquares(mask: Uint8Array, w: number, h: number): [Point, Point][] {
  const segs: [Point, Point][] = [];
  for (let cy = 0; cy < h - 1; cy++) {
    for (let cx = 0; cx < w - 1; cx++) {
      const c = (mask[cy * w + cx]         === 1 ? 8 : 0)
              | (mask[cy * w + cx + 1]     === 1 ? 4 : 0)
              | (mask[(cy+1) * w + cx + 1] === 1 ? 2 : 0)
              | (mask[(cy+1) * w + cx]     === 1 ? 1 : 0);
      for (const [e1, e2] of MS_TABLE[c]!)
        segs.push([edgeMid(cx, cy, e1), edgeMid(cx, cy, e2)]);
    }
  }
  return segs;
}

// ─── Connexion par index de segment ──────────────────────────────────────────

const ptKey = (p: Point) => `${Math.round(p.x * 2)},${Math.round(p.y * 2)}`;

function connectSegments(segs: [Point, Point][]): Point[][] {
  if (!segs.length) return [];

  type E = { segIdx: number; other: Point };
  const adj = new Map<string, E[]>();
  for (let i = 0; i < segs.length; i++) {
    const [a, b] = segs[i]!;
    const ka = ptKey(a!), kb = ptKey(b!);
    if (!adj.has(ka)) adj.set(ka, []);
    if (!adj.has(kb)) adj.set(kb, []);
    adj.get(ka)!.push({ segIdx: i, other: b! });
    adj.get(kb)!.push({ segIdx: i, other: a! });
  }

  const used = new Uint8Array(segs.length);
  const result: Point[][] = [];

  for (let si = 0; si < segs.length; si++) {
    if (used[si]) continue;
    const poly: Point[] = [];
    let seg = si, cur = segs[si]![0]!;
    for (let g = 0; g < 60_000; g++) {
      if (used[seg]) break;
      used[seg] = 1;
      poly.push(cur);
      const [a, b] = segs[seg]!;
      const nxt  = ptKey(a!) === ptKey(cur) ? b! : a!;
      const next = adj.get(ptKey(nxt))?.find((e) => !used[e.segIdx]);
      if (!next) { poly.push(nxt); break; }
      seg = next.segIdx; cur = nxt;
    }
    if (poly.length >= 4) result.push(poly);
  }
  return result;
}

// ─── Aire polygonale ──────────────────────────────────────────────────────────

function polygonArea(pts: Point[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

// ─── Douglas-Peucker ──────────────────────────────────────────────────────────

function douglasPeucker(pts: Point[], tol: number): Point[] {
  if (pts.length <= 2) return pts;
  const a = pts[0]!, b = pts[pts.length - 1]!;
  let maxD = 0, maxI = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i]!, a, b);
    if (d > maxD) { maxD = d; maxI = i; }
  }
  if (maxD > tol) {
    return [
      ...douglasPeucker(pts.slice(0, maxI + 1), tol).slice(0, -1),
      ...douglasPeucker(pts.slice(maxI), tol),
    ];
  }
  return [a, b];
}

function perpDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy);
  if (!l) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dx * (a.y - p.y) - (a.x - p.x) * dy) / l;
}

// ─── Offset bevel join ────────────────────────────────────────────────────────

function normalBevelOffset(pts: Point[], dist: number): Point[] {
  if (!dist || pts.length < 3) return pts;
  const r1 = _off(pts, dist,  1);
  const r2 = _off(pts, dist, -1);
  return polygonArea(r1) >= polygonArea(r2) ? r1 : r2;
}

function _off(pts: Point[], dist: number, s: 1 | -1): Point[] {
  const n = pts.length, res: Point[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]!, cur = pts[i]!, next = pts[(i + 1) % n]!;
    const e1x = cur.x - prev.x, e1y = cur.y - prev.y;
    const e2x = next.x - cur.x, e2y = next.y - cur.y;
    const l1 = Math.hypot(e1x, e1y) || 1, l2 = Math.hypot(e2x, e2y) || 1;
    const n1x = s * e1y / l1, n1y = s * (-e1x) / l1;
    const n2x = s * e2y / l2, n2y = s * (-e2x) / l2;
    const bx = n1x + n2x, by = n1y + n2y, bl = Math.hypot(bx, by);
    if (bl < 0.01) { res.push({ x: cur.x + n1x * dist, y: cur.y + n1y * dist }); continue; }
    const m = dist * 2 / bl;
    if (m > dist * BEVEL_THRESHOLD) {
      res.push({ x: cur.x + n1x * dist, y: cur.y + n1y * dist });
      res.push({ x: cur.x + n2x * dist, y: cur.y + n2y * dist });
    } else {
      res.push({ x: cur.x + (bx / bl) * m, y: cur.y + (by / bl) * m });
    }
  }
  return res;
}

// ─── Lissage ──────────────────────────────────────────────────────────────────

function smoothPolygon(pts: Point[], passes: number): Point[] {
  let c = pts;
  for (let p = 0; p < passes; p++) {
    const n = c.length;
    c = c.map((pt, i) => ({
      x: c[(i-1+n)%n]!.x * 0.25 + pt.x * 0.5 + c[(i+1)%n]!.x * 0.25,
      y: c[(i-1+n)%n]!.y * 0.25 + pt.y * 0.5 + c[(i+1)%n]!.y * 0.25,
    }));
  }
  return c;
}

// ─── SVG path ─────────────────────────────────────────────────────────────────

function toSvgPath(pts: Point[]): string {
  if (!pts.length) return "";
  const r = (v: number) => Math.round(v * 10) / 10;
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${r(p.x)},${r(p.y)}`).join(" ") + " Z";
}
