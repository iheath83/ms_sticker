import {
  getAllStickerShapes,
  getAllStickerSizes,
  getAllStickerMaterials,
  getAllStickerLaminations,
} from "@/lib/sticker-catalog-actions";
import { StickerCatalogClient } from "./sticker-catalog-client";

export const metadata = { title: "Catalogue sticker — Admin" };

export default async function StickerCatalogPage() {
  const [shapes, sizes, materials, laminations] = await Promise.all([
    getAllStickerShapes(),
    getAllStickerSizes(),
    getAllStickerMaterials(),
    getAllStickerLaminations(),
  ]);

  return (
    <StickerCatalogClient
      shapes={shapes}
      sizes={sizes}
      materials={materials}
      laminations={laminations}
    />
  );
}
