import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Client as MinioClient } from "minio";

export const runtime = "nodejs";

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function getMinioClient() {
  const endPoint = process.env["MINIO_ENDPOINT"];
  if (!endPoint) throw new Error("MINIO_ENDPOINT is not set");
  return new MinioClient({
    endPoint,
    port: process.env["MINIO_PORT"] ? parseInt(process.env["MINIO_PORT"], 10) : 9000,
    useSSL: process.env["MINIO_USE_SSL"] === "true",
    accessKey: process.env["MINIO_ACCESS_KEY"] ?? "",
    secretKey: process.env["MINIO_SECRET_KEY"] ?? "",
  });
}

function getBucket(): string {
  const b = process.env["MINIO_BUCKET"];
  if (!b) throw new Error("MINIO_BUCKET is not set");
  return b;
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "FormData invalide" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string | null) ?? "products";
  const entityId = (formData.get("entityId") as string | null) ?? "general";

  if (!file) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Type de fichier non autorisé. Formats acceptés : PNG, JPG, WebP, GIF, SVG" },
      { status: 400 },
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 10 Mo)" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const uuid = crypto.randomUUID();
  const key = `${folder}/${entityId}/${uuid}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const client = getMinioClient();
    const bucket = getBucket();
    await client.putObject(bucket, key, buffer, buffer.length, { "content-type": file.type });

    const proxyUrl = `/api/uploads/download?key=${encodeURIComponent(key)}`;
    return NextResponse.json({ url: proxyUrl, key });
  } catch (err) {
    console.error("[admin-uploads] MinIO error:", err);
    return NextResponse.json({ error: "Erreur de stockage" }, { status: 500 });
  }
}
