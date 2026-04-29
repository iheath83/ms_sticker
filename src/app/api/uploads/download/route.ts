import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { orderFiles, orders } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { streamObject } from "@/lib/storage";
import { Readable } from "stream";

// Prefixes that are public catalog assets (no auth / order check required)
const PUBLIC_PREFIXES = ["categories/", "products/", "logo/"];

function isPublicAsset(key: string): boolean {
  return PUBLIC_PREFIXES.some((p) => key.startsWith(p));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (!key) {
    return new Response(JSON.stringify({ error: "Paramètre key manquant" }), { status: 400 });
  }

  // ── Public catalog assets (categories, products images) ───────────────────
  if (isPublicAsset(key)) {
    try {
      const { stream, contentType, size } = await streamObject(key);
      const filename = key.split("/").pop() ?? "file";
      const responseHeaders = new Headers({
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Content-Disposition": `inline; filename="${filename}"`,
      });
      if (size) responseHeaders.set("Content-Length", String(size));
      const webStream = Readable.toWeb(stream as Readable) as ReadableStream;
      return new Response(webStream, { headers: responseHeaders });
    } catch (err) {
      console.error("[file-proxy] MinIO error (public asset):", err);
      return new Response(JSON.stringify({ error: "Impossible de récupérer le fichier" }), { status: 500 });
    }
  }

  // ── Order files: require auth + orderId ownership check ───────────────────
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
  }

  const orderId = searchParams.get("orderId");
  if (!orderId) {
    return new Response(JSON.stringify({ error: "Paramètre orderId manquant" }), { status: 400 });
  }

  const role = (session.user as { role?: string }).role;

  const [order] = await db
    .select({ userId: orders.userId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return new Response(JSON.stringify({ error: "Commande introuvable" }), { status: 404 });
  }

  if (role !== "admin" && order.userId !== session.user.id) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 403 });
  }

  const [file] = await db
    .select({ id: orderFiles.id, originalFilename: orderFiles.originalFilename, mimeType: orderFiles.mimeType })
    .from(orderFiles)
    .where(and(eq(orderFiles.storageKey, key), eq(orderFiles.orderId, orderId)))
    .limit(1);

  if (!file) {
    return new Response(JSON.stringify({ error: "Fichier introuvable" }), { status: 404 });
  }

  try {
    const { stream, contentType, size } = await streamObject(key);

    const filename = file.originalFilename ?? key.split("/").pop() ?? "file";
    const isDownload = searchParams.get("download") === "1";

    const responseHeaders = new Headers({
      "Content-Type": file.mimeType ?? contentType,
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": isDownload
        ? `attachment; filename="${filename}"`
        : `inline; filename="${filename}"`,
    });
    if (size) responseHeaders.set("Content-Length", String(size));

    const webStream = Readable.toWeb(stream as Readable) as ReadableStream;
    return new Response(webStream, { headers: responseHeaders });
  } catch (err) {
    console.error("[file-proxy] MinIO error:", err);
    return new Response(JSON.stringify({ error: "Impossible de récupérer le fichier" }), { status: 500 });
  }
}
