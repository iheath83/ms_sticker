/**
 * Génération du fichier de production PDF pour l'éditeur de sticker.
 *
 * Spec :
 * - PDF en 300 dpi (la résolution réelle dépend des pixels source de l'image,
 *   on garantit la taille millimétrique exacte choisie par le client)
 * - Sans fond (l'image est embeddée telle quelle, transparence préservée)
 * - Cut contour en ton direct magenta (CMJN), nommé "CutContour" — séparation
 *   reconnue par les RIP d'imprimerie : C=0 M=1 Y=0 K=0
 * - Épaisseur du trait de coupe : 0.2 mm
 * - Page à la taille exacte du sticker (mm → pt)
 *
 * Référence Adobe / PDF 1.7 §8.6.6 : Separation Color Spaces.
 */

import {
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFOperator,
  PDFDict,
  degrees,
} from "pdf-lib";

const MM_TO_PT = 72 / 25.4;
const STROKE_WIDTH_MM = 0.2;
const STROKE_WIDTH_PT = STROKE_WIDTH_MM * MM_TO_PT; // ≈ 0.5669 pt

export interface PdfExportInput {
  /** Bytes de l'image client (PNG transparent ou JPG). */
  imageBytes: Uint8Array;
  imageMime: "image/png" | "image/jpeg";
  /** Dimensions de la page (= taille du sticker fini, sans fond perdu). */
  widthMm: number;
  heightMm: number;
  /** Position de l'image dans le sticker — origine top-left, centre en mm. */
  image: {
    centerXmm: number;
    centerYmm: number;
    widthMm: number;
    heightMm: number;
    /** Rotation Konva (sens horaire en degrés). */
    rotationDeg: number;
  };
  /**
   * Path SVG du cut contour exprimé en coordonnées mm avec origine top-left
   * du sticker. Commandes supportées : M, m, L, l, C, c, Z, z.
   */
  cutPathMm: string;
  metadata?: {
    title?: string;
    filename?: string;
  };
}

export async function buildProductionPdf(input: PdfExportInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setProducer("MS Adhésif — éditeur sticker");
  pdf.setCreator("MS Adhésif");
  if (input.metadata?.title) pdf.setTitle(input.metadata.title);

  const widthPt = input.widthMm * MM_TO_PT;
  const heightPt = input.heightMm * MM_TO_PT;
  const page = pdf.addPage([widthPt, heightPt]);

  // ── 1. Image client embeddée (résolution native, transparence préservée) ──
  const img =
    input.imageMime === "image/jpeg"
      ? await pdf.embedJpg(input.imageBytes)
      : await pdf.embedPng(input.imageBytes);

  drawImageCenteredRotated(page, img, input.image, input.heightMm);

  // ── 2. ColorSpace Separation "CutContour" (spot magenta CMJN) ──
  // Tableau Separation : [/Separation /Name /AlternateSpace TintTransform]
  // TintTransform = fonction Type 2 (exponentielle) : tint 0..1 → CMJN.
  const ctx = pdf.context;
  const tintFn = ctx.obj({
    FunctionType: 2,
    Domain: [0, 1],
    C0: [0, 0, 0, 0], // tint 0 → blanc
    C1: [0, 1, 0, 0], // tint 1 → 100 % magenta CMJN
    N: 1,
  });
  const cutContourCS = ctx.obj([
    PDFName.of("Separation"),
    PDFName.of("CutContour"),
    PDFName.of("DeviceCMYK"),
    tintFn,
  ]);
  const csRef = ctx.register(cutContourCS);

  // Attacher le ColorSpace aux Resources de la page.
  // ⚠ `lookup(key, type)` jette si la clef n'existe pas → on utilise
  // `lookupMaybe` (retourne undefined silencieusement).
  let resources = page.node.Resources();
  if (!resources) {
    resources = ctx.obj({});
    page.node.set(PDFName.of("Resources"), resources);
  }
  let colorSpaces = resources.lookupMaybe(PDFName.of("ColorSpace"), PDFDict);
  if (!colorSpaces) {
    colorSpaces = ctx.obj({});
    resources.set(PDFName.of("ColorSpace"), colorSpaces);
  }
  colorSpaces.set(PDFName.of("CutContour"), csRef);

  // ── 3. Trait du cut contour (path SVG → opérateurs PDF) ──
  const pathOps = svgPathToPdfOperators(input.cutPathMm, input.heightMm);
  if (pathOps.length > 0) {
    page.pushOperators(
      op("q"),
      op("CS", [PDFName.of("CutContour")]),
      op("SCN", [PDFNumber.of(1)]),
      op("w", [PDFNumber.of(STROKE_WIDTH_PT)]),
      op("J", [PDFNumber.of(1)]),
      op("j", [PDFNumber.of(1)]),
      ...pathOps,
      op("S"),
      op("Q"),
    );
  }

  return pdf.save({ useObjectStreams: false });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type ImageEmbedded = Awaited<ReturnType<PDFDocument["embedPng"]>>;
type AnyPage = ReturnType<PDFDocument["addPage"]>;
type PDFOperatorName = Parameters<typeof PDFOperator.of>[0];
type PDFOperatorArg = NonNullable<Parameters<typeof PDFOperator.of>[1]>[number];

function op(name: string, args?: PDFOperatorArg[]) {
  return PDFOperator.of(name as PDFOperatorName, args);
}

/**
 * Dessine l'image en respectant la position (centre en mm dans le sticker) et
 * la rotation (sens horaire, degrés) en convertissant vers le repère PDF
 * (origine bas-gauche, rotation CCW).
 */
function drawImageCenteredRotated(
  page: AnyPage,
  img: ImageEmbedded,
  pos: PdfExportInput["image"],
  pageHeightMm: number,
) {
  const imgWPt = pos.widthMm * MM_TO_PT;
  const imgHPt = pos.heightMm * MM_TO_PT;
  const cxPt = pos.centerXmm * MM_TO_PT;
  // Inversion de l'axe Y : PDF a l'origine en bas-gauche.
  const cyPt = (pageHeightMm - pos.centerYmm) * MM_TO_PT;

  if (!pos.rotationDeg) {
    page.drawImage(img, {
      x: cxPt - imgWPt / 2,
      y: cyPt - imgHPt / 2,
      width: imgWPt,
      height: imgHPt,
    });
    return;
  }

  // Konva : rotation horaire (CW) autour du centre.
  // PDF   : drawImage rotate est CCW autour du coin bas-gauche.
  // Pour rendre le sens horaire visible → on doit appliquer une rotation
  // négative en CCW (= rotation horaire). Comme l'axe Y est inversé,
  // la rotation autour de "haut" en Konva ↔ rotation autour de "bas" en PDF
  // s'inverse → on garde donc le même angle qu'en Konva (signe positif),
  // mais on l'exprime en CCW.
  const thetaRad = (pos.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(thetaRad);
  const sin = Math.sin(thetaRad);
  // Position du coin bas-gauche après rotation autour du centre :
  //   p = c + R · (-w/2, -h/2)
  const dx = cxPt + cos * (-imgWPt / 2) - sin * (-imgHPt / 2);
  const dy = cyPt + sin * (-imgWPt / 2) + cos * (-imgHPt / 2);
  page.drawImage(img, {
    x: dx,
    y: dy,
    width: imgWPt,
    height: imgHPt,
    rotate: degrees(pos.rotationDeg),
  });
}

/**
 * Parse un sous-ensemble de SVG path (M, L, C, Z + variantes minuscules
 * relatives) et renvoie les opérateurs PDF équivalents. Les coordonnées
 * d'entrée sont en mm (origine top-left du sticker), les coordonnées de
 * sortie en pt (origine bottom-left de la page → flip Y).
 */
function svgPathToPdfOperators(
  svg: string,
  pageHeightMm: number,
): PDFOperator[] {
  const tokens = svg.match(/[MLCHVZmlchvz]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g) ?? [];
  const ops: PDFOperator[] = [];
  let i = 0;
  let cursorX = 0;
  let cursorY = 0;
  let startX = 0;
  let startY = 0;
  let lastCmd = "";

  const toPt = (xMm: number, yMm: number) => {
    const xPt = xMm * MM_TO_PT;
    const yPt = (pageHeightMm - yMm) * MM_TO_PT;
    return [xPt, yPt] as const;
  };
  const num = (n: number) => PDFNumber.of(n);

  while (i < tokens.length) {
    const t = tokens[i]!;
    let cmd: string;
    if (/^[A-Za-z]$/.test(t)) {
      cmd = t;
      i++;
      // Si c'est "M" et qu'il y a d'autres paires après → les suivantes sont
      // implicitement des "L" (cf. spec SVG path).
    } else {
      // Réutilise la dernière commande, sauf que M répété devient L
      cmd = lastCmd === "M" ? "L" : lastCmd === "m" ? "l" : lastCmd;
    }
    lastCmd = cmd;

    if (cmd === "M" || cmd === "m") {
      const x = parseFloat(tokens[i++]!);
      const y = parseFloat(tokens[i++]!);
      const ax = cmd === "M" ? x : cursorX + x;
      const ay = cmd === "M" ? y : cursorY + y;
      const [px, py] = toPt(ax, ay);
      ops.push(op("m", [num(px), num(py)]));
      cursorX = ax;
      cursorY = ay;
      startX = ax;
      startY = ay;
    } else if (cmd === "L" || cmd === "l") {
      const x = parseFloat(tokens[i++]!);
      const y = parseFloat(tokens[i++]!);
      const ax = cmd === "L" ? x : cursorX + x;
      const ay = cmd === "L" ? y : cursorY + y;
      const [px, py] = toPt(ax, ay);
      ops.push(op("l", [num(px), num(py)]));
      cursorX = ax;
      cursorY = ay;
    } else if (cmd === "H" || cmd === "h") {
      const x = parseFloat(tokens[i++]!);
      const ax = cmd === "H" ? x : cursorX + x;
      const [px, py] = toPt(ax, cursorY);
      ops.push(op("l", [num(px), num(py)]));
      cursorX = ax;
    } else if (cmd === "V" || cmd === "v") {
      const y = parseFloat(tokens[i++]!);
      const ay = cmd === "V" ? y : cursorY + y;
      const [px, py] = toPt(cursorX, ay);
      ops.push(op("l", [num(px), num(py)]));
      cursorY = ay;
    } else if (cmd === "C" || cmd === "c") {
      const x1 = parseFloat(tokens[i++]!);
      const y1 = parseFloat(tokens[i++]!);
      const x2 = parseFloat(tokens[i++]!);
      const y2 = parseFloat(tokens[i++]!);
      const x = parseFloat(tokens[i++]!);
      const y = parseFloat(tokens[i++]!);
      const ax1 = cmd === "C" ? x1 : cursorX + x1;
      const ay1 = cmd === "C" ? y1 : cursorY + y1;
      const ax2 = cmd === "C" ? x2 : cursorX + x2;
      const ay2 = cmd === "C" ? y2 : cursorY + y2;
      const ax = cmd === "C" ? x : cursorX + x;
      const ay = cmd === "C" ? y : cursorY + y;
      const [p1x, p1y] = toPt(ax1, ay1);
      const [p2x, p2y] = toPt(ax2, ay2);
      const [p3x, p3y] = toPt(ax, ay);
      ops.push(
        op("c", [num(p1x), num(p1y), num(p2x), num(p2y), num(p3x), num(p3y)]),
      );
      cursorX = ax;
      cursorY = ay;
    } else if (cmd === "Z" || cmd === "z") {
      ops.push(op("h"));
      cursorX = startX;
      cursorY = startY;
    } else {
      // Commande non supportée → on saute le token (sécurité).
      i++;
    }
  }
  return ops;
}
