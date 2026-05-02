"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Stage, Layer, Rect, Image as KonvaImage, Transformer, Path, Line, Group } from "react-konva";
import type Konva from "konva";
import type { EditorImage, EditorSettings } from "@/lib/sticker-editor/editor.types";
import { mmToPx, computeScale } from "@/lib/sticker-editor/geometry.utils";

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
      {hasAlphaPath && image && settings.cutline.alphaCutlinePath && (
        <Layer listening={false}>
          <Group x={PAD_PX} y={PAD_PX}>
            <Path
              x={pathX}
              y={pathY}
              offsetX={image.originalWidthPx / 2}
              offsetY={image.originalHeightPx / 2}
              scaleX={imgW / image.originalWidthPx}
              scaleY={imgH / image.originalHeightPx}
              rotation={image.rotationDeg}
              data={settings.cutline.alphaCutlinePath}
              fill="#ffffff"
              stroke="transparent"
              shadowColor="rgba(15,23,42,0.18)"
              shadowBlur={6}
              shadowOffsetY={2}
            />
          </Group>
        </Layer>
      )}
      {/* Mode bounding_box : rect blanc à la position de la cutline */}
      {settings.cutline.method === "bounding_box" && bbGuides?.cutline && (
        <Layer listening={false}>
          <Group x={PAD_PX} y={PAD_PX}>
            <Rect
              {...bbGuides.cutline}
              fill="#ffffff"
              shadowColor="rgba(15,23,42,0.18)"
              shadowBlur={6}
              shadowOffsetY={2}
            />
          </Group>
        </Layer>
      )}

      {/* ── Artwork + Transformer ── */}
      <Layer>
        <Group x={PAD_PX} y={PAD_PX}>
          {konvaImg && image && (
            <KonvaImage
              ref={imageNodeRef}
              image={konvaImg}
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
            enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
            rotateEnabled={true}
            boundBoxFunc={(oldBox, newBox) => {
              if (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 20) return oldBox;
              return newBox;
            }}
          />
        </Group>
      </Layer>

      {/* ── Ligne de coupe alpha (suit l'image) ── */}
      {settings.showCutline && hasAlphaPath && image && settings.cutline.alphaCutlinePath && (
        <Layer listening={false}>
          <Group x={PAD_PX} y={PAD_PX}>
            <Path
              x={pathX}
              y={pathY}
              offsetX={image.originalWidthPx / 2}
              offsetY={image.originalHeightPx / 2}
              scaleX={imgW / image.originalWidthPx}
              scaleY={imgH / image.originalHeightPx}
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

      {/* ── Ligne de coupe bounding box (rect) ── */}
      {settings.showCutline &&
        settings.cutline.method === "bounding_box" &&
        bbGuides?.cutline && (
          <Layer listening={false}>
            <Group x={PAD_PX} y={PAD_PX}>
              <Rect
                {...bbGuides.cutline}
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
