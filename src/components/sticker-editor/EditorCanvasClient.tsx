"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Stage, Layer, Rect, Image as KonvaImage, Transformer, Path, Line, Group, Ellipse } from "react-konva";
import type Konva from "konva";
import type { EditorImage, EditorSettings } from "@/lib/sticker-editor/editor.types";
import { mmToPx, computeScale } from "@/lib/sticker-editor/geometry.utils";
import { computePathBounds } from "@/lib/sticker-editor/path-bounds";

// ─── Constantes couleurs (spec §12.1) ─────────────────────────────────────────
const COLOR_CUTLINE_THROUGH = "#00B3D8"; // cyan
const COLOR_CUTLINE_KISS = "#E91E8C";    // magenta

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  canvasWidthMm: number;
  canvasHeightMm: number;
  image: EditorImage | null;
  settings: EditorSettings;
  containerWidth: number;
  stageRef: React.RefObject<Konva.Stage | null>;
  onImageChange: (patch: Partial<EditorImage>) => void;
  /** Autorise le redimensionnement du visuel via les poignées du Transformer.
   *  False → seul le déplacement (drag) reste possible. */
  allowResize?: boolean;
}

// ─── Composant ───────────────────────────────────────────────────────────────
export default function EditorCanvasClient({
  canvasWidthMm,
  canvasHeightMm,
  image,
  settings,
  containerWidth,
  stageRef,
  onImageChange,
  allowResize = true,
}: Props) {
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const imageNodeRef = useRef<Konva.Image | null>(null);
  const [konvaImg, setKonvaImg] = useState<HTMLImageElement | null>(null);

  // Padding visuel interne du canvas Konva : laisse de l'espace autour
  // du sticker pour voir cutline + bleed sans qu'ils touchent le bord.
  const PAD_PX = 32;
  const scale = computeScale(containerWidth - 2 * PAD_PX, canvasWidthMm);
  const innerW = canvasWidthMm * scale;
  const innerH = canvasHeightMm * scale;
  const stageW = innerW + 2 * PAD_PX;
  const stageH = innerH + 2 * PAD_PX;

  // Charger l'image HTML pour Konva
  useEffect(() => {
    if (!image?.url) { setKonvaImg(null); return; }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setKonvaImg(img);
    img.onerror = () => setKonvaImg(null);
    img.src = image.url;
  }, [image?.url]);

  // Attacher le Transformer à l'image quand elle est montée
  useEffect(() => {
    if (!transformerRef.current || !imageNodeRef.current) return;
    transformerRef.current.nodes([imageNodeRef.current]);
    transformerRef.current.getLayer()?.batchDraw();
  }, [konvaImg]);

  // ── Callbacks transform ──
  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target as Konva.Image;
      const w = node.width() * node.scaleX();
      const h = node.height() * node.scaleY();
      onImageChange({
        xMm: (node.x() + w / 2) / scale,
        yMm: (node.y() + h / 2) / scale,
      });
    },
    [scale, onImageChange],
  );

  const handleTransformEnd = useCallback(
    (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target as Konva.Image;
      const newWPx = node.width() * node.scaleX();
      const newHPx = node.height() * node.scaleY();
      // Reset scale → bake into width/height
      node.scaleX(1);
      node.scaleY(1);
      node.width(newWPx);
      node.height(newHPx);
      onImageChange({
        widthMm: newWPx / scale,
        heightMm: newHPx / scale,
        xMm: (node.x() + newWPx / 2) / scale,
        yMm: (node.y() + newHPx / 2) / scale,
        rotationDeg: node.rotation(),
      });
    },
    [scale, onImageChange],
  );

  // ── Position absolue de l'image (coin haut-gauche) ──
  const imgX = image ? mmToPx(image.xMm, scale) - mmToPx(image.widthMm, scale) / 2 : 0;
  const imgY = image ? mmToPx(image.yMm, scale) - mmToPx(image.heightMm, scale) / 2 : 0;
  const imgW = image ? mmToPx(image.widthMm, scale) : 0;
  const imgH = image ? mmToPx(image.heightMm, scale) : 0;

  // ── Tight bbox du contenu non transparent (en coords display) ──
  // Calculée à partir du path alpha quand il est disponible. Sert à serrer
  // les formes géométriques (rond / carré / arrondi) au plus près du visuel
  // réel, en ignorant les marges transparentes du fichier source.
  const contentRect = (() => {
    if (!image || imgW <= 0 || imgH <= 0) return null;
    const path = settings.cutline.alphaCutlinePath;
    if (!path || settings.cutline.status !== "generated") return null;
    if (!(image.originalWidthPx > 0) || !(image.originalHeightPx > 0)) return null;
    const bounds = computePathBounds(path);
    if (!bounds) return null;
    const sx = imgW / image.originalWidthPx;
    const sy = imgH / image.originalHeightPx;
    return {
      x: imgX + bounds.minX * sx,
      y: imgY + bounds.minY * sy,
      width: bounds.width * sx,
      height: bounds.height * sy,
      // Centre + rayon (sur l'axe horizontal — on garde radiusX/Y pour
      // garder la même proportion). En mode "rond pur" on prendra le max.
      centerX: imgX + bounds.centerX * sx,
      centerY: imgY + bounds.centerY * sy,
      radiusX: bounds.radius * sx,
      radiusY: bounds.radius * sy,
    };
  })();

  // ── Guides bounding box ──
  const bbGuides = image
    ? computeBoundingBoxGuides(image, settings, scale)
    : null;

  // ── Couleur cutline ──
  const cutlineColor =
    settings.cutline.cutType === "through_cut" ? COLOR_CUTLINE_THROUGH : COLOR_CUTLINE_KISS;

  // ── Rendu du contour alpha (Konva.Path) ──
  const hasAlphaPath =
    settings.cutline.method === "alpha" &&
    settings.cutline.alphaCutlinePath &&
    settings.cutline.status === "generated";

  // Pour la rotation : le Path est positionné à l'image center avec offsetX/Y = imgW/2, imgH/2
  const pathX = imgX + imgW / 2;
  const pathY = imgY + imgH / 2;

  // Scale du Path en mode alpha (path en coords image originale → display).
  // Garde-fous stricts : on ne rend les Path que si TOUTES les dimensions
  // sont > 0, sinon Konva peut allouer un sub-canvas de taille 0 (crash
  // 'drawImage on canvas with width 0').
  const origW = image && image.originalWidthPx > 0 ? image.originalWidthPx : 0;
  const origH = image && image.originalHeightPx > 0 ? image.originalHeightPx : 0;
  const pathScaleX = origW > 0 ? imgW / origW : 1;
  const pathScaleY = origH > 0 ? imgH / origH : 1;
  const dimsValid = imgW > 0 && imgH > 0 && origW > 0 && origH > 0;
  const konvaImgReady =
    konvaImg && (konvaImg.naturalWidth ?? 0) > 0 && (konvaImg.naturalHeight ?? 0) > 0;

  return (
    <Stage ref={stageRef} width={stageW} height={stageH} style={{ cursor: "default" }}>
      {/* ── Fond global gris : la zone du sticker physique sera dessinée
            en blanc à l'intérieur de la cutline UNIQUEMENT ── */}
      <Layer listening={false}>
        <Rect x={0} y={0} width={stageW} height={stageH} fill="#F3F4F6" />
      </Layer>

      {/* ── Fond blanc = surface physique du sticker (intérieur du kiss cut) ── */}
      {/* Mode alpha : suit la silhouette. Le path est en coords image originale,
          on le scale via scaleX/scaleY du node Konva. */}
      {hasAlphaPath && image && dimsValid && settings.cutline.alphaCutlinePath && (
        <Layer listening={false}>
          <Group x={PAD_PX} y={PAD_PX}>
            <Path
              x={pathX}
              y={pathY}
              offsetX={origW / 2}
              offsetY={origH / 2}
              scaleX={pathScaleX}
              scaleY={pathScaleY}
              rotation={image.rotationDeg}
              data={settings.cutline.alphaCutlinePath}
              fill="#ffffff"
              stroke="transparent"
            />
          </Group>
        </Layer>
      )}
      {/* Modes géométriques (rectangle / rond / arrondi) : fond blanc */}
      {(settings.cutline.method === "bounding_box" ||
        settings.cutline.method === "circle" ||
        settings.cutline.method === "rounded") &&
        image &&
        imgW > 0 &&
        imgH > 0 && (
          <Layer listening={false}>
            <Group x={PAD_PX} y={PAD_PX}>
              <GeometricCutShape
                imageRect={{ x: imgX, y: imgY, width: imgW, height: imgH }}
                contentRect={contentRect}
                offsetPx={mmToPx(settings.cutline.offsetMm, scale)}
                method={settings.cutline.method}
                fill="#ffffff"
              />
            </Group>
          </Layer>
        )}

      {/* ── Artwork + Transformer ── */}
      <Layer>
        <Group x={PAD_PX} y={PAD_PX}>
          {konvaImgReady && image && imgW > 0 && imgH > 0 && (
            <KonvaImage
              ref={imageNodeRef}
              image={konvaImg ?? undefined}
              x={imgX}
              y={imgY}
              width={imgW}
              height={imgH}
              rotation={image.rotationDeg}
              draggable
              onDragEnd={handleDragEnd}
              onTransformEnd={handleTransformEnd}
            />
          )}
          <Transformer
            ref={transformerRef}
            keepRatio={true}
            resizeEnabled={allowResize}
            enabledAnchors={
              allowResize
                ? ["top-left", "top-right", "bottom-left", "bottom-right"]
                : []
            }
            rotateEnabled={true}
            boundBoxFunc={(oldBox, newBox) => {
              if (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 20) return oldBox;
              return newBox;
            }}
          />
        </Group>
      </Layer>

      {/* ── Ligne de coupe alpha (suit l'image) ── */}
      {settings.showCutline && hasAlphaPath && image && dimsValid && settings.cutline.alphaCutlinePath && (
        <Layer listening={false}>
          <Group x={PAD_PX} y={PAD_PX}>
            <Path
              x={pathX}
              y={pathY}
              offsetX={origW / 2}
              offsetY={origH / 2}
              scaleX={pathScaleX}
              scaleY={pathScaleY}
              rotation={image.rotationDeg}
              data={settings.cutline.alphaCutlinePath}
              stroke={cutlineColor}
              strokeWidth={1.5}
              fill="transparent"
              dash={[5, 3]}
              strokeScaleEnabled={false}
              dashEnabled
            />
          </Group>
        </Layer>
      )}

      {/* ── Ligne de coupe géométrique (rectangle / rond / arrondi) ── */}
      {settings.showCutline &&
        (settings.cutline.method === "bounding_box" ||
          settings.cutline.method === "circle" ||
          settings.cutline.method === "rounded") &&
        image &&
        imgW > 0 &&
        imgH > 0 && (
          <Layer listening={false}>
            <Group x={PAD_PX} y={PAD_PX}>
              <GeometricCutShape
                imageRect={{ x: imgX, y: imgY, width: imgW, height: imgH }}
                contentRect={contentRect}
                offsetPx={mmToPx(settings.cutline.offsetMm, scale)}
                method={settings.cutline.method}
                stroke={cutlineColor}
                strokeWidth={1.5}
                fill="transparent"
                dash={[5, 3]}
              />
            </Group>
          </Layer>
        )}

      {/* ── Grille ── */}
      {settings.showGrid && (
        <Layer listening={false}>
          <Group x={PAD_PX} y={PAD_PX}>
            <GridLines stageW={innerW} stageH={innerH} stepMm={10} scale={scale} />
          </Group>
        </Layer>
      )}
    </Stage>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Rend la forme de découpe géométrique adaptée au contenu réel du visuel.
 *
 * Si `contentRect` est fournie (= tight bbox des pixels non transparents
 * extraite du contour alpha), elle prime sur `imageRect` (= bbox du fichier
 * source) pour serrer la forme au plus près du visuel — sans toucher de
 * pixel rempli. Sinon on retombe sur `imageRect`.
 *
 * - `bounding_box` : rectangle = bbox du contenu élargie de `offsetPx`
 * - `rounded`      : idem avec coins arrondis (rayon ≈ 12 % du plus petit côté)
 * - `circle`       : cercle minimal englobant le contenu, centré sur la
 *   tight bbox + `offsetPx` de marge. Si le contour n'est pas disponible,
 *   fallback sur l'ellipse circonscrite à `imageRect` (× √2).
 */
function GeometricCutShape({
  imageRect,
  contentRect,
  offsetPx,
  method,
  ...visualProps
}: {
  imageRect: { x: number; y: number; width: number; height: number };
  contentRect: {
    x: number;
    y: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
  } | null;
  offsetPx: number;
  method: "bounding_box" | "circle" | "rounded" | "alpha";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: number[];
}) {
  if (method === "circle") {
    if (contentRect) {
      // Cercle (rayons identiques) qui englobe tous les pixels remplis.
      const radius = Math.max(contentRect.radiusX, contentRect.radiusY) + offsetPx;
      return (
        <Ellipse
          x={contentRect.centerX}
          y={contentRect.centerY}
          radiusX={radius}
          radiusY={radius}
          {...visualProps}
        />
      );
    }
    // Fallback (pas de contour disponible) : ellipse circonscrite × √2.
    const cx = imageRect.x + imageRect.width / 2;
    const cy = imageRect.y + imageRect.height / 2;
    const radiusX = (imageRect.width / 2) * Math.SQRT2 + offsetPx;
    const radiusY = (imageRect.height / 2) * Math.SQRT2 + offsetPx;
    return <Ellipse x={cx} y={cy} radiusX={radiusX} radiusY={radiusY} {...visualProps} />;
  }

  // Pour rect / rounded : tight bbox du contenu si dispo, sinon bbox image.
  const base = contentRect
    ? { x: contentRect.x, y: contentRect.y, width: contentRect.width, height: contentRect.height }
    : imageRect;
  const rect = {
    x: base.x - offsetPx,
    y: base.y - offsetPx,
    width: base.width + 2 * offsetPx,
    height: base.height + 2 * offsetPx,
  };

  if (method === "rounded") {
    const cornerRadius = Math.min(rect.width, rect.height) * 0.12;
    return <Rect {...rect} cornerRadius={cornerRadius} {...visualProps} />;
  }
  return <Rect {...rect} {...visualProps} />;
}

function computeBoundingBoxGuides(
  image: EditorImage,
  settings: EditorSettings,
  scale: number,
) {
  const xPx = mmToPx(image.xMm, scale) - mmToPx(image.widthMm, scale) / 2;
  const yPx = mmToPx(image.yMm, scale) - mmToPx(image.heightMm, scale) / 2;
  const wPx = mmToPx(image.widthMm, scale);
  const hPx = mmToPx(image.heightMm, scale);

  const offsetPx = mmToPx(settings.cutline.offsetMm, scale);
  const bleedPx = mmToPx(settings.bleedMm, scale);
  const safetyPx = mmToPx(settings.safetyMarginMm, scale);

  return {
    cutline: {
      x: xPx - offsetPx,
      y: yPx - offsetPx,
      width: wPx + 2 * offsetPx,
      height: hPx + 2 * offsetPx,
    },
    bleed: {
      x: xPx - offsetPx - bleedPx,
      y: yPx - offsetPx - bleedPx,
      width: wPx + 2 * (offsetPx + bleedPx),
      height: hPx + 2 * (offsetPx + bleedPx),
    },
    safety: {
      x: xPx - safetyPx,
      y: yPx - safetyPx,
      width: wPx + 2 * safetyPx,
      height: hPx + 2 * safetyPx,
    },
  };
}

/**
 * Produit un path légèrement agrandi (fond perdu) à partir du path alpha cutline.
 * Utilise une transformation de mise à l'échelle simple autour du centre de l'image.
 */
// ─── Grille ───────────────────────────────────────────────────────────────────

function GridLines({
  stageW,
  stageH,
  stepMm,
  scale,
}: {
  stageW: number;
  stageH: number;
  stepMm: number;
  scale: number;
}) {
  const lines: React.ReactNode[] = [];
  const stepPx = mmToPx(stepMm, scale);

  for (let x = stepPx; x < stageW; x += stepPx) {
    lines.push(
      <Line
        key={`v${x}`}
        points={[x, 0, x, stageH]}
        stroke="#E5E7EB"
        strokeWidth={0.5}
        listening={false}
      />,
    );
  }
  for (let y = stepPx; y < stageH; y += stepPx) {
    lines.push(
      <Line
        key={`h${y}`}
        points={[0, y, stageW, y]}
        stroke="#E5E7EB"
        strokeWidth={0.5}
        listening={false}
      />,
    );
  }
  return <>{lines}</>;
}
