import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 chars"),
  BETTER_AUTH_URL: z.string().url(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  STRIPE_PUBLIC_KEY: z.string().startsWith("pk_"),

  // Pennylane
  PENNYLANE_API_KEY: z.string().min(1),
  PENNYLANE_API_BASE: z.string().url().default("https://app.pennylane.com/api/external/v2"),

  // MinIO Object Storage
  // MINIO_ENDPOINT: hostname or IP (e.g. 54.38.37.66 or minio.example.com)
  MINIO_ENDPOINT: z.string().min(1, "MINIO_ENDPOINT is required"),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().min(1).default("msadhesif"),
  MINIO_USE_SSL: z.enum(["true", "false"]).default("false"),

  // Brevo
  BREVO_API_KEY: z.string().min(1),
  BREVO_FROM_EMAIL: z.string().email(),
  BREVO_FROM_NAME: z.string().default("MS Adhésif"),

  // VIES
  VIES_CACHE_TTL_HOURS: z.coerce.number().positive().default(24),

  // App
  APP_URL: z.string().url(),
  APP_ENV: z.enum(["development", "production"]).default("development"),

  // Public (build-time) — used by auth-client.ts on the client side
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_STRIPE_PUBLIC_KEY: z.string().startsWith("pk_"),
});

function createEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables. Check your .env.local file.");
  }

  return parsed.data;
}

// Lazy singleton — only validated once at first import
let _env: z.infer<typeof envSchema> | undefined;

export function getEnv(): z.infer<typeof envSchema> {
  if (!_env) {
    _env = createEnv();
  }
  return _env;
}

// Named exports for convenience
export type Env = z.infer<typeof envSchema>;
