import type {
  StickerShape,
  StickerSize,
  StickerMaterial,
  StickerLamination,
  ProductStickerConfig,
} from "@/db/schema";

export type { StickerShape, StickerSize, StickerMaterial, StickerLamination, ProductStickerConfig };

export interface PriceBreakdown {
  surfaceCm2: number;
  quantityDiscountPct: number;
  materialMultiplier: number;
  laminationMultiplier: number;
  shapeMultiplier: number;
  unitPriceCents: number;
  subtotalCents: number;
  vatAmountCents: number;
  totalCents: number;
  setupFeeCents: number;
  shape: { id: string; name: string; code: string };
  material: { id: string; name: string };
  lamination: { id: string; name: string } | null;
}

export interface UploadedFile {
  key: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ConfiguratorState {
  selectedShapeId: string;
  sizeMode: "preset" | "custom";
  selectedSizeId: string;
  customWidth: number;
  customHeight: number;
  quantity: number;
  useCustomQty: boolean;
  customQuantity: string;
  selectedMaterialId: string;
  selectedLaminationId: string | null;
  customerNote: string;
  uploadedFile: UploadedFile | null;
  uploadState: "idle" | "dragging" | "uploading" | "uploaded" | "error";
  uploadError: string | null;
  priceResult: PriceBreakdown | null;
  priceLoading: boolean;
  addState: "idle" | "loading" | "success" | "error";
}

export type ConfiguratorAction =
  | { type: "SELECT_SHAPE"; id: string }
  | { type: "SELECT_SIZE"; id: string }
  | { type: "SET_SIZE_MODE"; mode: "preset" | "custom" }
  | { type: "SET_CUSTOM_WIDTH"; value: number }
  | { type: "SET_CUSTOM_HEIGHT"; value: number }
  | { type: "SELECT_QUANTITY"; qty: number }
  | { type: "SET_CUSTOM_QTY_MODE"; on: boolean }
  | { type: "SET_CUSTOM_QTY_VALUE"; value: string }
  | { type: "SELECT_MATERIAL"; id: string }
  | { type: "SELECT_LAMINATION"; id: string | null }
  | { type: "SET_NOTE"; note: string }
  | { type: "SET_UPLOAD_STATE"; state: ConfiguratorState["uploadState"]; error?: string }
  | { type: "SET_UPLOADED_FILE"; file: UploadedFile | null }
  | { type: "SET_PRICE"; result: PriceBreakdown | null; loading: boolean }
  | { type: "SET_ADD_STATE"; state: ConfiguratorState["addState"] };
