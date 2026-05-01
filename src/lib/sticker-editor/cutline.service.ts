/**
 * Génération de ligne de coupe kiss cut (alpha channel).
 *
 * Stratégie : padding + fermeture morphologique légère.
 *
 *  1. Canvas avec PADDING transparent autour
 *     → garantit que le contour extérieur est toujours UNE boucle fermée
 *  2. Image dessinée dans la zone centrale (200×200) avec 10 px de marge
 *  3. Masque binaire alpha
 *  4. Fermeture morphologique R=8 (modeste : MS + ADHÉSIF se touchent
 *     presque, juste besoin de combler les petits gaps entre lettres)
 *  5. Marching squares → segments
 *  6. Connexion par index de segment → polygones
 *  7. Contour extérieur = polygone avec la plus grande BBOX
 *     (le padding garantit que le contour extérieur englobe tous les autres)
 *  8. Soustraction du padding, scaling display, offset, lissage
 */

interface Point { x: number; y: number; }

// ─── Paramètres ───────────────────────────────────────────────────────────────

const INNER_SIZE      = 200;   // zone d'analyse réelle
const PAD             = 10;    // bordure transparente garantie
const GRID_SIZE       = INNER_SIZE + 2 * PAD;
const ALPHA_THRESHOLD = 15;
const CLOSE_RADIUS    = 14;    // fusionne les concavités entre lettres
const SIMPLIFY_TOL    = 1.2;   // plus de simplification = moins de bumps
const SMOOTH_PASSES   = 6;     // plus de lissage = aspect blob kiss cut
const BEVEL_THRESHOLD = 1.4;

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

  // 1. Charger
  let img: HTMLImageElement;
  try { img = await loadImageElement(imageUrl); }
  catch { return { ok: false, error: "load_failed", message: "Impossible de charger l'image." }; }

  // 2. Canvas avec padding : image dessinée dans [PAD..PAD+INNER_SIZE]
  const canvas = document.createElement("canvas");
  canvas.width = GRID_SIZE; canvas.height = GRID_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, error: "no_contour", message: "Canvas non disponible." };
  ctx.clearRect(0, 0, GRID_SIZE, GRID_SIZE);
  ctx.drawImage(img, PAD, PAD, INNER_SIZE, INNER_SIZE);

  // 3. Masque binaire
  const { data } = ctx.getImageData(0, 0, GRID_SIZE, GRID_SIZE);
  const mask = new Uint8Array(GRID_SIZE * GRID_SIZE) as Uint8Array<ArrayBuffer>;
  let opaque = 0;
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    if ((data[i * 4 + 3] ?? 0) > ALPHA_THRESHOLD) { mask[i] = 1; opaque++; }
  }

  if (opaque / (INNER_SIZE * INNER_SIZE) > 0.96) {
    return { ok: false, error: "no_transparency",
      message: "Votre image n'a pas de fond transparent. Utilisez un PNG avec canal alpha pour la découpe à la forme." };
  }
  if (opaque < 4) {
    return { ok: false, error: "no_contour", message: "Image trop peu opaque." };
  }

  // 4. Fermeture morphologique légère (bridge les petits gaps)
  const dilated = morphSep(mask,    GRID_SIZE, GRID_SIZE, CLOSE_RADIUS, "dilate");
  const closed  = morphSep(dilated, GRID_SIZE, GRID_SIZE, CLOSE_RADIUS, "erode");

  // 5. Marching squares (bordures garanties à 0 → contour fermé)
  const segs = marchingSquares(closed, GRID_SIZE, GRID_SIZE);
  if (!segs.length) return { ok: false, error: "no_contour", message: "Aucun contour détecté." };

  // 6. Connexion en polygones
  const polys = connectSegments(segs);
  if (!polys.length) return { ok: false, error: "no_contour", message: "Impossible de construire le contour." };

  // 7. Contour extérieur = polygone avec la plus grande bbox
  const outer = pickOuterPolygon(polys);
  if (!outer || outer.length < 3) {
    return { ok: false, error: "no_contour", message: "Contour trop petit." };
  }

  // 8. Retirer le padding (passer en repère [0..INNER_SIZE])
  const unpadded = outer.map(p => ({ x: p.x - PAD, y: p.y - PAD }));

  // 9. Simplification
  const simplified = douglasPeucker(unpadded, SIMPLIFY_TOL);

  // 10. Scaling vers l'affichage
  const sx = displayW / INNER_SIZE, sy = displayH / INNER_SIZE;
  const scaled = simplified.map(p => ({ x: p.x * sx, y: p.y * sy }));

  // 11. Offset polygonal
  const expanded = offsetPx > 0 ? normalBevelOffset(scaled, offsetPx) : scaled;

  // 12. Lissage
  const smoothed = smoothPolygon(expanded, SMOOTH_PASSES);

  return { ok: true, result: { pathData: toSvgPath(smoothed), pointCount: smoothed.length } };
}

// ─── Sélection du contour extérieur ───────────────────────────────────────────

/**
 * Avec padding garanti, le contour extérieur est le polygone qui couvre
 * la plus grande zone (bbox la plus grande). Les "trous" internes ont
 * forcément des bbox plus petites que le contour extérieur.
 */
function pickOuterPolygon(polys: Point[][]): Point[] | null {
  let best: Point[] | null = null;
  let bestBboxArea = 0;
  for (const p of polys) {
    if (p.length < 3) continue;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pt of p) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
    const a = (maxX - minX) * (maxY - minY);
    if (a > bestBboxArea) { bestBboxArea = a; best = p; }
  }
  return best;
}

// ─── Chargement ───────────────────────────────────────────────────────────────

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error("load_failed"));
    img.src = url;
  });
}

// ─── Morphologie séparable ────────────────────────────────────────────────────

function morphSep(
  src: Uint8Array, w: number, h: number, r: number, op: "dilate" | "erode",
): Uint8Array {
  const isDilate = op === "dilate";
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

const MS_TABLE: [0|1|2|3, 0|1|2|3][][] = [
  [], [[3,2]], [[2,1]], [[3,1]],
  [[0,1]], [[3,0],[1,2]], [[0,2]], [[3,0]],
  [[0,3]], [[0,2]], [[0,1],[3,2]], [[0,1]],
  [[3,1]], [[2,1]], [[3,2]], [],
];

function edgeMid(cx: number, cy: number, e: 0|1|2|3): Point {
  switch (e) {
    case 0: return { x: cx+0.5, y: cy };
    case 1: return { x: cx+1, y: cy+0.5 };
    case 2: return { x: cx+0.5, y: cy+1 };
    case 3: return { x: cx, y: cy+0.5 };
  }
}

function marchingSquares(mask: Uint8Array, w: number, h: number): [Point,Point][] {
  const segs: [Point,Point][] = [];
  for (let cy = 0; cy < h-1; cy++) for (let cx = 0; cx < w-1; cx++) {
    const c = (mask[cy*w+cx]===1?8:0)|(mask[cy*w+cx+1]===1?4:0)
            |(mask[(cy+1)*w+cx+1]===1?2:0)|(mask[(cy+1)*w+cx]===1?1:0);
    for (const [e1,e2] of MS_TABLE[c]!) segs.push([edgeMid(cx,cy,e1), edgeMid(cx,cy,e2)]);
  }
  return segs;
}

// ─── Connexion ────────────────────────────────────────────────────────────────

const ptKey = (p: Point) => `${Math.round(p.x*2)},${Math.round(p.y*2)}`;

function connectSegments(segs: [Point,Point][]): Point[][] {
  type E = { si: number; o: Point };
  const adj = new Map<string,E[]>();
  for (let i = 0; i < segs.length; i++) {
    const [a,b] = segs[i]!;
    const ka = ptKey(a!), kb = ptKey(b!);
    if (!adj.has(ka)) adj.set(ka,[]);
    if (!adj.has(kb)) adj.set(kb,[]);
    adj.get(ka)!.push({si:i, o:b!});
    adj.get(kb)!.push({si:i, o:a!});
  }
  const used = new Uint8Array(segs.length);
  const res: Point[][] = [];
  for (let si = 0; si < segs.length; si++) {
    if (used[si]) continue;
    const poly: Point[] = [];
    let seg = si, cur = segs[si]![0]!;
    for (let g = 0; g < 200_000; g++) {
      if (used[seg]) break;
      used[seg] = 1; poly.push(cur);
      const [a,b] = segs[seg]!;
      const nxt = ptKey(a!)===ptKey(cur) ? b! : a!;
      const nx = adj.get(ptKey(nxt))?.find(e=>!used[e.si]);
      if (!nx) { poly.push(nxt); break; }
      seg = nx.si; cur = nxt;
    }
    if (poly.length >= 3) res.push(poly);
  }
  return res;
}

function polyArea(pts: Point[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p=pts[i]!, q=pts[(i+1)%pts.length]!;
    a += p.x*q.y - q.x*p.y;
  }
  return Math.abs(a)/2;
}

function douglasPeucker(pts: Point[], tol: number): Point[] {
  if (pts.length <= 2) return pts;
  const a=pts[0]!, b=pts[pts.length-1]!;
  let md=0, mi=0;
  for (let i=1; i<pts.length-1; i++) { const d=pdist(pts[i]!,a,b); if(d>md){md=d;mi=i;} }
  if (md>tol) return [...douglasPeucker(pts.slice(0,mi+1),tol).slice(0,-1), ...douglasPeucker(pts.slice(mi),tol)];
  return [a,b];
}
function pdist(p:Point, a:Point, b:Point): number {
  const dx=b.x-a.x, dy=b.y-a.y, l=Math.hypot(dx,dy);
  if(!l) return Math.hypot(p.x-a.x, p.y-a.y);
  return Math.abs(dx*(a.y-p.y)-(a.x-p.x)*dy)/l;
}

function normalBevelOffset(pts: Point[], dist: number): Point[] {
  const r1=_off(pts,dist,1), r2=_off(pts,dist,-1);
  return polyArea(r1)>=polyArea(r2)?r1:r2;
}
function _off(pts: Point[], dist: number, s: 1|-1): Point[] {
  const n=pts.length, res: Point[]=[];
  for (let i=0;i<n;i++) {
    const pr=pts[(i-1+n)%n]!, cu=pts[i]!, nx=pts[(i+1)%n]!;
    const e1x=cu.x-pr.x, e1y=cu.y-pr.y, l1=Math.hypot(e1x,e1y)||1;
    const e2x=nx.x-cu.x, e2y=nx.y-cu.y, l2=Math.hypot(e2x,e2y)||1;
    const n1x=s*e1y/l1, n1y=s*(-e1x)/l1;
    const n2x=s*e2y/l2, n2y=s*(-e2x)/l2;
    const bx=n1x+n2x, by=n1y+n2y, bl=Math.hypot(bx,by);
    if (bl<0.01){ res.push({x:cu.x+n1x*dist,y:cu.y+n1y*dist}); continue; }
    const m=dist*2/bl;
    if (m>dist*BEVEL_THRESHOLD) {
      res.push({x:cu.x+n1x*dist,y:cu.y+n1y*dist});
      res.push({x:cu.x+n2x*dist,y:cu.y+n2y*dist});
    } else {
      res.push({x:cu.x+(bx/bl)*m,y:cu.y+(by/bl)*m});
    }
  }
  return res;
}

function smoothPolygon(pts: Point[], passes: number): Point[] {
  let c=pts;
  for (let p=0;p<passes;p++) {
    const n=c.length;
    c=c.map((pt,i)=>({
      x:c[(i-1+n)%n]!.x*0.25+pt.x*0.5+c[(i+1)%n]!.x*0.25,
      y:c[(i-1+n)%n]!.y*0.25+pt.y*0.5+c[(i+1)%n]!.y*0.25,
    }));
  }
  return c;
}

function toSvgPath(pts: Point[]): string {
  if (!pts.length) return "";
  const r=(v:number)=>Math.round(v*10)/10;
  return pts.map((p,i)=>`${i===0?"M":"L"}${r(p.x)},${r(p.y)}`).join(" ")+" Z";
}
