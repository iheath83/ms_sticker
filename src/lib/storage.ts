import { Client as MinioClient } from "minio";
import type { BucketItem } from "minio";

// Singleton MinIO client
let _client: MinioClient | undefined;

function getClient(): MinioClient {
  if (!_client) {
    const endPoint = process.env["MINIO_ENDPOINT"];
    if (!endPoint) throw new Error("MINIO_ENDPOINT is not set");

    const port = process.env["MINIO_PORT"] ? parseInt(process.env["MINIO_PORT"], 10) : 9000;
    const useSSL = process.env["MINIO_USE_SSL"] === "true";

    _client = new MinioClient({
      endPoint,
      port,
      useSSL,
      accessKey: process.env["MINIO_ACCESS_KEY"] ?? "",
      secretKey: process.env["MINIO_SECRET_KEY"] ?? "",
    });
  }
  return _client;
}

function getBucket(): string {
  const bucket = process.env["MINIO_BUCKET"];
  if (!bucket) throw new Error("MINIO_BUCKET is not set");
  return bucket;
}

// Storage key convention: orders/{orderId}/{type}/{yyyymmdd}-{uuid}-{filename}
export function buildStorageKey(
  orderId: string,
  type: "customer_upload" | "proof" | "final_artwork",
  filename: string,
): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const uuid = crypto.randomUUID();
  return `orders/${orderId}/${type}/${date}-${uuid}-${filename}`;
}

// Generate a presigned PUT URL for direct client-side upload (15 min TTL)
export async function getPresignedUploadUrl(key: string): Promise<string> {
  return getClient().presignedPutObject(getBucket(), key, 15 * 60);
}

// Generate a presigned GET URL for download (1h TTL)
export async function getPresignedDownloadUrl(key: string): Promise<string> {
  return getClient().presignedGetObject(getBucket(), key, 60 * 60);
}

// Stream an object directly (used by the proxy route — never exposes MinIO URL)
export async function streamObject(
  key: string,
): Promise<{ stream: NodeJS.ReadableStream; contentType: string; size: number | null }> {
  const client = getClient();
  const bucket = getBucket();

  const stat = await client.statObject(bucket, key);
  const contentType = stat.metaData?.["content-type"] as string | undefined ?? "application/octet-stream";

  const stream = await client.getObject(bucket, key);
  return { stream, contentType, size: stat.size ?? null };
}

// Delete an object
export async function deleteObject(key: string): Promise<void> {
  await getClient().removeObject(getBucket(), key);
}

// Ensure the bucket exists (called at startup / migration)
export async function ensureBucketExists(): Promise<void> {
  const client = getClient();
  const bucket = getBucket();
  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket, "us-east-1");
  }
}

// List objects under a prefix (used for admin / audit)
export async function listObjects(prefix: string): Promise<BucketItem[]> {
  return new Promise((resolve, reject) => {
    const objects: BucketItem[] = [];
    const stream = getClient().listObjects(getBucket(), prefix, true);
    stream.on("data", (obj: BucketItem) => objects.push(obj));
    stream.on("end", () => resolve(objects));
    stream.on("error", reject);
  });
}
