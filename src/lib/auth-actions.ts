"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

// ─── Result type ──────────────────────────────────────────────────────────────

type Result<T = void, E = string> =
  | { ok: true; data: T }
  | { ok: false; error: E };

// ─── Schemas ─────────────────────────────────────────────────────────────────

const signUpSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

const signInSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Email invalide"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function signUpAction(
  formData: FormData,
): Promise<Result<{ email: string }>> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Données invalides" };
  }

  try {
    await auth.api.signUpEmail({
      body: parsed.data,
      headers: await headers(),
    });
    return { ok: true, data: { email: parsed.data.email } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur lors de l'inscription";
    if (msg.toLowerCase().includes("already")) {
      return { ok: false, error: "Un compte existe déjà avec cet email" };
    }
    return { ok: false, error: "Erreur lors de l'inscription, veuillez réessayer" };
  }
}

export async function signInAction(
  formData: FormData,
  callbackUrl?: string,
): Promise<Result> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Données invalides" };
  }

  try {
    await auth.api.signInEmail({
      body: parsed.data,
      headers: await headers(),
    });
  } catch {
    return { ok: false, error: "Email ou mot de passe incorrect" };
  }

  redirect(callbackUrl ?? "/account");
}

export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}

export async function forgotPasswordAction(
  formData: FormData,
): Promise<Result<{ email: string }>> {
  const raw = { email: formData.get("email") };
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Email invalide" };
  }

  try {
    await auth.api.requestPasswordReset({
      body: {
        email: parsed.data.email,
        redirectTo: `${process.env["APP_URL"] ?? "http://localhost:3000"}/reset-password`,
      },
      headers: await headers(),
    });
  } catch {
    // silently succeed — avoid email enumeration
  }

  return { ok: true, data: { email: parsed.data.email } };
}

export async function resetPasswordAction(
  formData: FormData,
): Promise<Result> {
  const raw = {
    token: formData.get("token"),
    password: formData.get("password"),
  };

  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Données invalides" };
  }

  try {
    await auth.api.resetPassword({
      body: { newPassword: parsed.data.password, token: parsed.data.token },
      headers: await headers(),
    });
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Lien expiré ou invalide. Demandez un nouveau lien." };
  }
}

// ─── Session helper (Server Component) ────────────────────────────────────────

export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() });
}
