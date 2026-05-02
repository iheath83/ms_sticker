/**
 * Analyse d'un path SVG (généré par le service Python pour la découpe à
 * la forme) afin d'en déduire :
 *  - la *tight bounding box* (rectangle minimal englobant les pixels non
 *    transparents)
 *  - le centre + rayon du cercle minimal englobant centré sur la tight bbox
 *
 * Le path est exprimé en coordonnées **pixels d'image originale**. Toutes
 * les valeurs retournées sont dans le même repère.
 *
 * Le format produit par le service Python est uniquement composé de `M`
 * (moveTo) et `L` (lineTo), ce qui permet une analyse simple sans librairie
 * de parsing SVG complète.
 */

export interface PathBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  /** Rayon du cercle centré sur (centerX, centerY) qui englobe tous les
   *  points du contour. */
  radius: number;
}

/**
 * Parse un path SVG composé de M/L et retourne la liste des points.
 * Tolère les variantes m/l (relative) — le service Python n'en émet pas
 * mais on reste défensif.
 */
function extractPoints(svgPath: string): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  // Tokens de la forme `M 12.3 45.6` ou `L -1 0` ou `Z`. On capture aussi
  // les minuscules au cas où.
  const tokenRegex = /([MLmlZz])\s*([-\d.eE+]*)\s*,?\s*([-\d.eE+]*)/g;
  let cursorX = 0;
  let cursorY = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(svgPath)) !== null) {
    const cmd = match[1];
    const a = parseFloat(match[2] ?? "");
    const b = parseFloat(match[3] ?? "");
    if (cmd === "M" || cmd === "L") {
      if (Number.isFinite(a) && Number.isFinite(b)) {
        cursorX = a;
        cursorY = b;
        points.push([cursorX, cursorY]);
      }
    } else if (cmd === "m" || cmd === "l") {
      if (Number.isFinite(a) && Number.isFinite(b)) {
        cursorX += a;
        cursorY += b;
        points.push([cursorX, cursorY]);
      }
    }
    // Z / z : ferme le sous-chemin, pas de nouveau point à ajouter
  }
  return points;
}

/**
 * Calcule la tight bbox + le rayon du cercle minimal centré sur le centre
 * de la bbox. Retourne `null` si le path ne contient aucun point exploitable.
 *
 * Note : le cercle minimal absolu (problème de Welzl) n'est pas toujours
 * centré au centre de la bbox. On utilise le centre de la bbox comme
 * approximation : c'est légèrement plus large mais visuellement très proche
 * pour les visuels de stickers (généralement quasi-symétriques) et beaucoup
 * plus simple à calculer.
 */
export function computePathBounds(svgPath: string): PathBounds | null {
  const points = extractPoints(svgPath);
  if (points.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  if (width <= 0 || height <= 0) return null;

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  let radiusSq = 0;
  for (const [x, y] of points) {
    const dx = x - centerX;
    const dy = y - centerY;
    const d2 = dx * dx + dy * dy;
    if (d2 > radiusSq) radiusSq = d2;
  }
  const radius = Math.sqrt(radiusSq);

  return { minX, minY, maxX, maxY, width, height, centerX, centerY, radius };
}
