import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { sendTemplatedEmail } from "@/lib/mail";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // simplified for MVP — enable in prod with Brevo
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      await sendTemplatedEmail(
        "password-reset",
        user.email,
        {
          customerName: user.name ?? user.email.split("@")[0],
          resetUrl: url,
        },
        user.name ?? undefined,
      ).catch((err) => console.error("[auth] sendResetPassword email failed:", err));
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24,       // refresh if older than 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,              // 5 min client-side cache
    },
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "customer",
        input: false, // not settable by the user
      },
    },
  },

  baseURL: process.env["BETTER_AUTH_URL"] ?? process.env["APP_URL"] ?? "http://localhost:3000",
  secret: process.env["BETTER_AUTH_SECRET"] ?? "",

  trustedOrigins: [
    process.env["APP_URL"] ?? "http://localhost:3000",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
  ],
});

export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
