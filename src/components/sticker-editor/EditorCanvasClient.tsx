"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Stage, Layer, Rect, Image as KonvaImage, Transformer, Group } from "react-konva";
import type Konva from "konva";
import type { EditorImage, EditorSettings } from "@/lib/sticker-editor/editor.types";
import { mmToPx, computeScale } from "@/lib/sticker-editor/geometry.utils";

// ─── Constantes couleurs (spec §12.1) ─────────────────────────────────────────
const COLOR_CUTLINE_THROUGH = "#00B3D8"; // cyan
const COLOR_CUTLINE_KISS = "#E91E8C";    // magenta
const COLOR_BLEED = "#F87171";           // rouge clair
const COLOR_SAFETY = "#22C55E";          // vert
const DASHES_GUIDE = [6, 4];

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

  const scale = computeScale(containerWidth, canvasWidthMm);
  const stageW = canvasWidthMm * scale;
  const stageH = canvasHeightMm * scale;

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
      onImageChange({
        xMm: (node.x() + node.width() * node.scaleX() / 2) / scale,
        yMm: (node.y() + node.height() * node.scaleY() / 2) / scale,
      });
    },
    [scale, onImageChange],
  );

  const handleTransformEnd = useCallback(
    (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target as Konva.Image;
      const newWPx = node.width() * node.scaleX();
      const newHPx = node.height() * node.scaleY();
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

  // ── Calcul des rects guides (en px) ──
  const guides = image
    ? computeGuides(image, settings, scale)
    : null;

  return (
    <Stage ref={stageRef} width={stageW} height={stageH} style={{ cursor: "crosshair" }}>
      {/* ── Fond blanc ── */}
      <Layer>
        <Rect x={0} y={0} width={stageW} height={stageH} fill="#ffffff" />
      </Layer>

      {/* ── Calque fond perdu (sous l'image) ── */}
      {settings.showBleed && guides?.bleed && (
        <Layer>
          <Rect
            {...guides.bleed}
            stroke={COLOR_BLEED}
            strokeWidth={1.5}
            fill="rgba(248,113,113,0.07)"
            dash={DASHES_GUIDE}
            listening={false}
          />
        </Layer>
      )}

      {/* ── Calque artwork ── */}
      <Layer>
        {konvaImg && image && (
          <KonvaImage
            ref={imageNodeRef}
            image={konvaImg}
            x={mmToPx(image.xMm, scale) - mmToPx(image.widthMm, scale) / 2}
            y={mmToPx(image.yMm, scale) - mmToPx(image.heightMm, scale) / 2}
            width={mmToPx(image.widthMm, scale)}
            height={mmToPx(image.heightMm, scale)}
            rotation={image.rotationDeg}
            offsetX={0}
            offsetY={0}
            draggable
            onDragEnd={handleDragEnd}
            onTransformEnd={handleTransformEnd}
          />
        )}
        <Transformer
          ref={transformerRef}
          rotateEnabled={true}
          keepRatio={false}
          enabledAnchors={[
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
            "middle-left",
            "middle-right",
            "top-center",
            "bottom-center",
          ]}
          boundBoxFunc={(oldBox, newBox) => {
            if (Math.abs(newBox.width) < 10 || Math.abs(newBox.height) < 10) return oldBox;
            return newBox;
          }}
        />
      </Layer>

      {/* ── Calque zone de sécurité ── */}
      {settings.showSafety && guides?.safety && (
        <Layer listening={false}>
          <Rect
            {...guides.safety}
            stroke={COLOR_SAFETY}
            strokeWidth={1}
            fill="rgba(34,197,94,0.05)"
            dash={DASHES_GUIDE}
          />
        </Layer>
      )}

      {/* ── Calque ligne de coupe ── */}
      {settings.showCutline && settings.cutline.enabled && guides?.cutline && (
        <Layer listening={false}>
          <Rect
            {...guides.cutline}
            stroke={
              settings.cutline.cutType === "through_cut"
                ? COLOR_CUTLINE_THROUGH
                : COLOR_CUTLINE_KISS
            }
            strokeWidth={1.5}
            fill="transparent"
            dash={[5, 3]}
          />
        </Layer>
      )}

      {/* ── Grille optionnelle ── */}
      {settings.showGrid && (
        <Layer listening={false}>
          <GridLines stageW={stageW} stageH={stageH} stepMm={10} scale={scale} />
        </Layer>
      )}
    </Stage>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeGuides(
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
      x: xPx + safetyPx,
      y: yPx + safetyPx,
      width: Math.max(0, wPx - 2 * safetyPx),
      height: Math.max(0, hPx - 2 * safetyPx),
    },
  };
}

// ─── Grille ───────────────────────────────────────────────────────────────────
import { Line } from "react-konva";

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
