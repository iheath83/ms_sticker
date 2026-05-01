/**
 * Génération de ligne de coupe kiss cut.
 *
 * Principe : grille TRÈS basse résolution (25×25).
 * À cette résolution, les micro-gaps entre éléments du logo (emblem + texte)
 * deviennent sub-pixel et les formes fusionnent naturellement en UN seul blob.
 * Le marching squares donne directement UN seul contour qui suit la silhouette
 * globale — pas besoin de morphologie ou de convex hull.
 */

interface Point { x: number; y: number; }

// ─── Paramètres ───────────────────────────────────────────────────────────────

/** Résolution très basse : les gaps sub-pixel fusionnent naturellement. */
const GRID_SIZE       = 25;
const ALPHA_THRESHOLD = 15;
const SIMPLIFY_TOL    = 0.5;
const SMOOTH_PASSES   = 4;  // 4 passes → contour bien arrondi kiss cut
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

  let img: HTMLImageElement;
  try { img = await loadImageElement(imageUrl); }
  catch { return { ok: false, error: "load_failed", message: "Impossible de charger l'image." }; }

  // Canvas basse résolution
  const canvas = document.createElement("canvas");
  canvas.width = GRID_SIZE; canvas.height = GRID_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, error: "no_contour", message: "Canvas non disponible." };
  ctx.drawImage(img, 0, 0, GRID_SIZE, GRID_SIZE);

  // Masque binaire
  const { data } = ctx.getImageData(0, 0, GRID_SIZE, GRID_SIZE);
  const mask = new Uint8Array(GRID_SIZE * GRID_SIZE) as Uint8Array<ArrayBuffer>;
  let opaque = 0;
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    if ((data[i * 4 + 3] ?? 0) > ALPHA_THRESHOLD) { mask[i] = 1; opaque++; }
  }

  if (opaque / (GRID_SIZE * GRID_SIZE) > 0.96) {
    return { ok: false, error: "no_transparency",
      message: "Votre image n'a pas de fond transparent. Utilisez un PNG avec canal alpha pour la découpe à la forme." };
  }
  if (opaque < 4) {
    return { ok: false, error: "no_contour", message: "Image trop peu opaque." };
  }

  // Marching squares — à 25×25 les gaps intra-logo sont sub-pixel → un seul blob
  const segs = marchingSquares(mask, GRID_SIZE, GRID_SIZE);
  if (!segs.length) return { ok: false, error: "no_contour", message: "Aucun contour détecté." };

  const polys = connectSegments(segs);
  if (!polys.length) return { ok: false, error: "no_contour", message: "Impossible de construire le contour." };

  // Plus grand polygone = contour extérieur global
  const raw = [...polys].sort((a, b) => polyArea(b) - polyArea(a))[0] ?? [];
  if (raw.length < 3) return { ok: false, error: "no_contour", message: "Contour trop petit." };

  // Simplifier
  const simplified = douglasPeucker(raw, SIMPLIFY_TOL);

  // Mise à l'échelle display
  const sx = displayW / GRID_SIZE, sy = displayH / GRID_SIZE;
  const scaled = simplified.map(p => ({ x: p.x * sx, y: p.y * sy }));

  // Offset bevel join
  const expanded = offsetPx > 0 ? normalBevelOffset(scaled, offsetPx) : scaled;

  // Lissage
  const smoothed = smoothPolygon(expanded, SMOOTH_PASSES);

  return { ok: true, result: { pathData: toSvgPath(smoothed), pointCount: smoothed.length } };
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

// ─── Connexion par index de segment ──────────────────────────────────────────

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
    for (let g = 0; g < 20_000; g++) {
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

// ─── Aire ─────────────────────────────────────────────────────────────────────

function polyArea(pts: Point[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p=pts[i]!, q=pts[(i+1)%pts.length]!;
    a += p.x*q.y - q.x*p.y;
  }
  return Math.abs(a)/2;
}

// ─── Douglas-Peucker ──────────────────────────────────────────────────────────

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

// ─── Offset bevel join ────────────────────────────────────────────────────────

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

// ─── Lissage ──────────────────────────────────────────────────────────────────

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

// ─── SVG path ─────────────────────────────────────────────────────────────────

function toSvgPath(pts: Point[]): string {
  if (!pts.length) return "";
  const r=(v:number)=>Math.round(v*10)/10;
  return pts.map((p,i)=>`${i===0?"M":"L"}${r(p.x)},${r(p.y)}`).join(" ")+" Z";
}
