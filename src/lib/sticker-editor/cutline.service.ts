/**
 * Génération de ligne de coupe à la forme (alpha channel) via canvas HTML5.
 *
 * Pipeline :
 *  1. Dessin de l'image sur canvas offscreen à résolution réduite
 *  2. Extraction du masque binaire depuis le canal alpha
 *  3. Dilatation morphologique (lissage du bord)
 *  4. Marching squares → segments de contour
 *  5. Connexion des segments en polygone(s)
 *  6. Simplification Douglas-Peucker
 *  7. Lissage par moyenne mobile
 *  8. Mise à l'échelle vers la taille d'affichage
 *  9. Offset radial (expansion vers l'extérieur)
 * 10. Conversion en SVG path
 */

interface Point {
  x: number;
  y: number;
}

// ─── Paramètres ───────────────────────────────────────────────────────────────

const GRID_SIZE = 120; // résolution d'analyse (px)
const ALPHA_THRESHOLD = 10; // seuil de transparence (0-255)
const SIMPLIFY_TOLERANCE = 1.2; // tolérance Douglas-Peucker (en unités grille)
const SMOOTH_PASSES = 2; // passes de lissage

// ─── API publique ─────────────────────────────────────────────────────────────

export interface CutlineResult {
  /** SVG path data, avec (0,0) = coin haut-gauche de l'image affichée */
  pathData: string;
  /** Nombre de points dans le polygone final */
  pointCount: number;
}

/**
 * Génère un chemin SVG de découpe à la forme à partir du canal alpha d'une image.
 *
 * @param imageUrl     URL (object URL ou data URL) de l'image source
 * @param displayW     Largeur d'affichage en pixels (canvas Konva)
 * @param displayH     Hauteur d'affichage en pixels (canvas Konva)
 * @param offsetPx     Marge d'offset vers l'extérieur en pixels
 */
export async function generateAlphaCutline(
  imageUrl: string,
  displayW: number,
  displayH: number,
  offsetPx: number,
): Promise<CutlineResult | null> {
  // 1. Charger l'image
  const img = await loadImageElement(imageUrl);

  // 2. Dessiner sur canvas à résolution réduite
  const canvas = document.createElement("canvas");
  canvas.width = GRID_SIZE;
  canvas.height = GRID_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, GRID_SIZE, GRID_SIZE);

  // 3. Masque binaire depuis alpha
  const { data } = ctx.getImageData(0, 0, GRID_SIZE, GRID_SIZE);
  let mask = new Uint8Array(GRID_SIZE * GRID_SIZE) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    mask[i] = (data[i * 4 + 3] ?? 0) > ALPHA_THRESHOLD ? 1 : 0;
  }

  // 4. Dilatation morphologique (comble les petits trous, adoucit le bord)
  mask = morphDilate(mask, GRID_SIZE, GRID_SIZE, 2) as Uint8Array<ArrayBuffer>;

  // 5. Marching squares → segments
  const segments = marchingSquares(mask, GRID_SIZE, GRID_SIZE);
  if (!segments.length) return null;

  // 6. Connexion en polygone(s)
  const polygons = connectSegments(segments);
  if (!polygons.length) return null;

  // 7. Polygone le plus grand
  const raw = polygons.sort((a, b) => b.length - a.length)[0] ?? [];

  // 8. Simplification
  const simplified = douglasPeucker(raw, SIMPLIFY_TOLERANCE);

  // 9. Lissage
  const smoothed = smoothPolygon(simplified, SMOOTH_PASSES);

  // 10. Mise à l'échelle vers la taille d'affichage
  const scaleX = displayW / GRID_SIZE;
  const scaleY = displayH / GRID_SIZE;
  const scaled = smoothed.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));

  // 11. Offset radial (expansion vers l'extérieur par rapport au centroïde)
  const expanded = offsetPx > 0 ? radialOffset(scaled, offsetPx) : scaled;

  // 12. SVG path
  const pathData = toSvgPath(expanded);

  return { pathData, pointCount: expanded.length };
}

// ─── Utilitaires internes ─────────────────────────────────────────────────────

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// ─── Dilatation morphologique ─────────────────────────────────────────────────

function morphDilate(
  mask: Uint8Array,
  w: number,
  h: number,
  r: number,
): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let found = false;
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r && !found; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w && mask[ny * w + nx] === 1) {
            found = true;
          }
        }
      }
      out[y * w + x] = found ? 1 : 0;
    }
  }
  return out;
}

// ─── Marching squares ─────────────────────────────────────────────────────────

/**
 * Table des segments par case.
 * Case = (tl<<3)|(tr<<2)|(br<<1)|(bl<<0)
 * Arêtes : 0=haut, 1=droite, 2=bas, 3=gauche
 */
const MS_TABLE: [0 | 1 | 2 | 3, 0 | 1 | 2 | 3][][] = [
  [],              // 0  rien
  [[3, 2]],        // 1  BL seul
  [[2, 1]],        // 2  BR seul
  [[3, 1]],        // 3  BL+BR
  [[0, 1]],        // 4  TR seul
  [[3, 0], [1, 2]], // 5  TR+BL saddle
  [[0, 2]],        // 6  TR+BR
  [[3, 0]],        // 7  TR+BR+BL (TL dehors)
  [[0, 3]],        // 8  TL seul
  [[0, 2]],        // 9  TL+BL
  [[0, 1], [3, 2]], // 10 TL+BR saddle
  [[0, 1]],        // 11 TL+BL+BR
  [[3, 1]],        // 12 TL+TR
  [[2, 1]],        // 13 TL+TR+BL
  [[3, 2]],        // 14 TL+TR+BR
  [],              // 15 tout dedans
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

// ─── Connexion en polygone ────────────────────────────────────────────────────

const ptKey = (p: Point) => `${Math.round(p.x * 4)},${Math.round(p.y * 4)}`;

function connectSegments(segments: [Point, Point][]): Point[][] {
  // Adjacence : clé de point → liste de points connectés
  const adj = new Map<string, { p: Point; to: Point[] }>();

  for (const [a, b] of segments) {
    const ka = ptKey(a);
    const kb = ptKey(b);
    if (!adj.has(ka)) adj.set(ka, { p: a, to: [] });
    if (!adj.has(kb)) adj.set(kb, { p: b, to: [] });
    adj.get(ka)!.to.push(b);
    adj.get(kb)!.to.push(a);
  }

  const visited = new Set<string>();
  const polygons: Point[][] = [];

  for (const [startKey, { p: startPt }] of adj) {
    if (visited.has(startKey)) continue;

    const poly: Point[] = [];
    let curKey = startKey;
    let prevKey = "";

    for (let guard = 0; guard < 50_000; guard++) {
      if (visited.has(curKey)) {
        if (curKey === startKey && poly.length > 2) break;
        break;
      }
      visited.add(curKey);
      const node = adj.get(curKey);
      if (!node) break;
      poly.push(node.p);

      const next = node.to.find((n) => ptKey(n) !== prevKey);
      if (!next) break;
      prevKey = curKey;
      curKey = ptKey(next);
    }

    if (poly.length >= 6) polygons.push(poly);
  }

  return polygons;
}

// ─── Douglas-Peucker ──────────────────────────────────────────────────────────

function douglasPeucker(pts: Point[], tol: number): Point[] {
  if (pts.length <= 2) return pts;
  let maxDist = 0;
  let maxIdx = 0;
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;

  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpendicularDist(pts[i]!, first, last);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }

  if (maxDist > tol) {
    const left = douglasPeucker(pts.slice(0, maxIdx + 1), tol);
    const right = douglasPeucker(pts.slice(maxIdx), tol);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

function perpendicularDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (!len) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dx * (a.y - p.y) - (a.x - p.x) * dy) / len;
}

// ─── Lissage (moyenne mobile) ─────────────────────────────────────────────────

function smoothPolygon(pts: Point[], passes: number): Point[] {
  let cur = pts;
  for (let pass = 0; pass < passes; pass++) {
    const n = cur.length;
    cur = cur.map((p, i) => ({
      x: (cur[(i - 1 + n) % n]!.x + p.x + cur[(i + 1) % n]!.x) / 3,
      y: (cur[(i - 1 + n) % n]!.y + p.y + cur[(i + 1) % n]!.y) / 3,
    }));
  }
  return cur;
}

// ─── Offset radial ────────────────────────────────────────────────────────────

/**
 * Expanse chaque point du polygone vers l'extérieur en s'éloignant du centroïde.
 * Simple et efficace pour les formes convexes et quasi-convexes.
 */
function radialOffset(pts: Point[], dist: number): Point[] {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;

  return pts.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * dist, y: p.y + (dy / len) * dist };
  });
}

// ─── SVG path ─────────────────────────────────────────────────────────────────

function toSvgPath(pts: Point[]): string {
  if (!pts.length) return "";
  const r = (n: number) => Math.round(n * 100) / 100;
  const parts = pts.map((p, i) => `${i === 0 ? "M" : "L"}${r(p.x)},${r(p.y)}`);
  return parts.join(" ") + " Z";
}
