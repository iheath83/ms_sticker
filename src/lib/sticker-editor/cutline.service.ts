/**
 * Génération de ligne de coupe à la forme (alpha channel) via canvas HTML5.
 *
 * Pipeline :
 *  1. Dessin de l'image sur canvas offscreen haute résolution
 *  2. Extraction du masque binaire (canal alpha)
 *  3. Fermeture morphologique (dilate + erode) pour :
 *     a) combler le vide entre parties disjointes du logo (texte + emblem)
 *     b) arrondir légèrement les coins sans distordre la forme
 *  4. Dilatation finale = offset utilisateur (toujours dans le masque)
 *  5. Marching squares → segments de contour
 *  6. Connexion des segments → polygones (par index de segment)
 *  7. Sélection du plus grand polygone (contour externe)
 *  8. Douglas-Peucker
 *  9. Mise à l'échelle vers la taille d'affichage
 * 10. Lissage léger
 * 11. Conversion SVG path
 *
 * Avantages par rapport à l'offset polygonal :
 *  - Pas de spikes sur angles aigus (étoile, serifs, coins)
 *  - Connecte automatiquement les parties disjointes (logo + texte séparés)
 *  - Précision correcte : l'offset est construit dans l'espace grille
 */

interface Point { x: number; y: number; }

// ─── Paramètres ───────────────────────────────────────────────────────────────

/** Résolution d'analyse interne (pixels). */
const GRID_SIZE = 280;
/** Seuil alpha : pixel "dedans" si alpha > valeur */
const ALPHA_THRESHOLD = 15;
/**
 * Rayon de connexion (fermeture morphologique).
 * Comble les vides jusqu'à 2×CONNECT_RADIUS px dans la grille.
 * 14px → ponte ~30px de vide en grille, soit ~(30/280)×displayW px d'écart max.
 */
const CONNECT_RADIUS = 14;
/** Tolérance Douglas-Peucker (unités grille). */
const SIMPLIFY_TOLERANCE = 0.8;
/** Passes de lissage léger */
const SMOOTH_PASSES = 1;

// ─── API publique ─────────────────────────────────────────────────────────────

export interface CutlineResult {
  pathData: string;
  pointCount: number;
}

export type CutlineError = "no_transparency" | "no_contour" | "load_failed";
export interface CutlineSuccess { ok: true; result: CutlineResult; }
export interface CutlineFailure { ok: false; error: CutlineError; message: string; }
export type CutlineOutcome = CutlineSuccess | CutlineFailure;

/**
 * Génère un chemin SVG de découpe à la forme depuis le canal alpha d'une image.
 * @param offsetPx Distance d'expansion en pixels d'affichage (≈ mm × scale).
 */
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

  // 2. Canvas offscreen
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

  const opaqueFraction = opaquePixels / (GRID_SIZE * GRID_SIZE);
  if (opaqueFraction > 0.96) {
    return {
      ok: false, error: "no_transparency",
      message: "Votre image n'a pas de fond transparent. Utilisez un PNG avec canal alpha pour la découpe à la forme.",
    };
  }

  // 4. Morphologie : fermeture (dilate+erode) pour connecter les parties + offset intégré
  //
  //    gridOffsetRadius = l'offset utilisateur converti en pixels grille
  //    totalDilateRadius = CONNECT_RADIUS + gridOffsetRadius
  //    → On dilate de totalDilateRadius, puis on erode de CONNECT_RADIUS
  //    → Résultat : fermeture par CONNECT_RADIUS (vides comblés, forme restaurée)
  //                  + expansion nette de gridOffsetRadius (= offsetPx en affichage)
  const gridOffsetRadius = Math.max(1, Math.round(offsetPx * GRID_SIZE / Math.max(displayW, displayH)));
  const totalDilateRadius = CONNECT_RADIUS + gridOffsetRadius;

  const bigDilated = morphDilateSep(mask, GRID_SIZE, GRID_SIZE, totalDilateRadius);
  const morphed = morphErodeSep(bigDilated, GRID_SIZE, GRID_SIZE, CONNECT_RADIUS);

  // 5. Marching squares → segments
  const segments = marchingSquares(morphed, GRID_SIZE, GRID_SIZE);
  if (!segments.length) {
    return { ok: false, error: "no_contour", message: "Aucun contour détecté dans l'image." };
  }

  // 6. Connexion en polygones
  const polygons = connectSegments(segments);
  if (!polygons.length) {
    return { ok: false, error: "no_contour", message: "Impossible de construire le contour." };
  }

  // 7. Plus grand polygone = contour extérieur principal
  const raw = polygons.sort((a, b) => polygonArea(b) - polygonArea(a))[0] ?? [];
  if (raw.length < 6) {
    return { ok: false, error: "no_contour", message: "Contour trop petit ou invalide." };
  }

  // 8. Douglas-Peucker
  const simplified = douglasPeucker(raw, SIMPLIFY_TOLERANCE);

  // 9. Mise à l'échelle vers la taille d'affichage
  const scaleX = displayW / GRID_SIZE, scaleY = displayH / GRID_SIZE;
  const scaled = simplified.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));

  // 10. Lissage léger
  const smoothed = smoothPolygon(scaled, SMOOTH_PASSES);

  // 11. SVG path
  const pathData = toSvgPath(smoothed);

  return { ok: true, result: { pathData, pointCount: smoothed.length } };
}

// ─── Chargement image ─────────────────────────────────────────────────────────

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("load_failed"));
    img.src = url;
  });
}

// ─── Morphologie séparable (square structuring element) ───────────────────────
//
// La séparabilité réduit la complexité de O(r²×n) à O(r×n).
// Un élément structurant carré produit des coins légèrement carrés,
// acceptable pour la production sticker.

function morphDilateSep(src: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(src.length);
  // Passe horizontale
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let found = false;
      const xMin = Math.max(0, x - r), xMax = Math.min(w - 1, x + r);
      for (let nx = xMin; nx <= xMax && !found; nx++) {
        if (src[y * w + nx] === 1) found = true;
      }
      tmp[y * w + x] = found ? 1 : 0;
    }
  }
  // Passe verticale
  const out = new Uint8Array(src.length) as Uint8Array<ArrayBuffer>;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let found = false;
      const yMin = Math.max(0, y - r), yMax = Math.min(h - 1, y + r);
      for (let ny = yMin; ny <= yMax && !found; ny++) {
        if (tmp[ny * w + x] === 1) found = true;
      }
      out[y * w + x] = found ? 1 : 0;
    }
  }
  return out;
}

function morphErodeSep(src: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(src.length);
  // Passe horizontale
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let allIn = true;
      const xMin = Math.max(0, x - r), xMax = Math.min(w - 1, x + r);
      for (let nx = xMin; nx <= xMax && allIn; nx++) {
        if (src[y * w + nx] !== 1) allIn = false;
      }
      tmp[y * w + x] = allIn ? 1 : 0;
    }
  }
  // Passe verticale
  const out = new Uint8Array(src.length) as Uint8Array<ArrayBuffer>;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let allIn = true;
      const yMin = Math.max(0, y - r), yMax = Math.min(h - 1, y + r);
      for (let ny = yMin; ny <= yMax && allIn; ny++) {
        if (tmp[ny * w + x] !== 1) allIn = false;
      }
      out[y * w + x] = allIn ? 1 : 0;
    }
  }
  return out;
}

// ─── Marching squares ─────────────────────────────────────────────────────────

const MS_TABLE: [0 | 1 | 2 | 3, 0 | 1 | 2 | 3][][] = [
  [],
  [[3, 2]],
  [[2, 1]],
  [[3, 1]],
  [[0, 1]],
  [[3, 0], [1, 2]],
  [[0, 2]],
  [[3, 0]],
  [[0, 3]],
  [[0, 2]],
  [[0, 1], [3, 2]],
  [[0, 1]],
  [[3, 1]],
  [[2, 1]],
  [[3, 2]],
  [],
];

function edgeMid(cx: number, cy: number, edge: 0 | 1 | 2 | 3): Point {
  switch (edge) {
    case 0: return { x: cx + 0.5, y: cy };
    case 1: return { x: cx + 1, y: cy + 0.5 };
    case 2: return { x: cx + 0.5, y: cy + 1 };
    case 3: return { x: cx, y: cy + 0.5 };
  }
}

function marchingSquares(mask: Uint8Array, w: number, h: number): [Point, Point][] {
  const segs: [Point, Point][] = [];
  for (let cy = 0; cy < h - 1; cy++) {
    for (let cx = 0; cx < w - 1; cx++) {
      const tl = mask[cy * w + cx] === 1;
      const tr = mask[cy * w + cx + 1] === 1;
      const br = mask[(cy + 1) * w + cx + 1] === 1;
      const bl = mask[(cy + 1) * w + cx] === 1;
      const c = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      for (const [e1, e2] of MS_TABLE[c]!) {
        segs.push([edgeMid(cx, cy, e1), edgeMid(cx, cy, e2)]);
      }
    }
  }
  return segs;
}

// ─── Connexion en polygones (par index de segment) ────────────────────────────

const ptKey = (p: Point) => `${Math.round(p.x * 2)},${Math.round(p.y * 2)}`;

function connectSegments(segs: [Point, Point][]): Point[][] {
  if (!segs.length) return [];

  type Entry = { segIdx: number; other: Point };
  const adj = new Map<string, Entry[]>();

  for (let i = 0; i < segs.length; i++) {
    const [a, b] = segs[i]!;
    const ka = ptKey(a!), kb = ptKey(b!);
    if (!adj.has(ka)) adj.set(ka, []);
    if (!adj.has(kb)) adj.set(kb, []);
    adj.get(ka)!.push({ segIdx: i, other: b! });
    adj.get(kb)!.push({ segIdx: i, other: a! });
  }

  const usedSegs = new Uint8Array(segs.length);
  const polygons: Point[][] = [];

  for (let startIdx = 0; startIdx < segs.length; startIdx++) {
    if (usedSegs[startIdx]) continue;

    const poly: Point[] = [];
    let segIdx = startIdx;
    let curPt = segs[startIdx]![0]!;

    for (let guard = 0; guard < 120_000; guard++) {
      if (usedSegs[segIdx]) break;
      usedSegs[segIdx] = 1;
      poly.push(curPt);

      const [sa, sb] = segs[segIdx]!;
      const nextPt = ptKey(sa!) === ptKey(curPt) ? sb! : sa!;
      const nextKey = ptKey(nextPt);
      const neighbors = adj.get(nextKey);
      const nextEntry = neighbors?.find((e) => !usedSegs[e.segIdx]);

      if (!nextEntry) { poly.push(nextPt); break; }
      segIdx = nextEntry.segIdx;
      curPt = nextPt;
    }

    if (poly.length >= 6) polygons.push(poly);
  }
  return polygons;
}

// ─── Aire polygonale ──────────────────────────────────────────────────────────

function polygonArea(pts: Point[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
    area += p.x * q.y - q.x * p.y;
  }
  return Math.abs(area) / 2;
}

// ─── Douglas-Peucker ──────────────────────────────────────────────────────────

function douglasPeucker(pts: Point[], tol: number): Point[] {
  if (pts.length <= 2) return pts;
  let maxDist = 0, maxIdx = 0;
  const first = pts[0]!, last = pts[pts.length - 1]!;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i]!, first, last);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist > tol) {
    const L = douglasPeucker(pts.slice(0, maxIdx + 1), tol);
    const R = douglasPeucker(pts.slice(maxIdx), tol);
    return [...L.slice(0, -1), ...R];
  }
  return [first, last];
}

function perpDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (!len) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dx * (a.y - p.y) - (a.x - p.x) * dy) / len;
}

// ─── Lissage (moyenne mobile) ─────────────────────────────────────────────────

function smoothPolygon(pts: Point[], passes: number): Point[] {
  let cur = pts;
  for (let p = 0; p < passes; p++) {
    const n = cur.length;
    cur = cur.map((pt, i) => ({
      x: cur[(i - 1 + n) % n]!.x * 0.25 + pt.x * 0.5 + cur[(i + 1) % n]!.x * 0.25,
      y: cur[(i - 1 + n) % n]!.y * 0.25 + pt.y * 0.5 + cur[(i + 1) % n]!.y * 0.25,
    }));
  }
  return cur;
}

// ─── SVG path ─────────────────────────────────────────────────────────────────

function toSvgPath(pts: Point[]): string {
  if (!pts.length) return "";
  const r = (n: number) => Math.round(n * 10) / 10;
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${r(p.x)},${r(p.y)}`).join(" ") + " Z";
}
