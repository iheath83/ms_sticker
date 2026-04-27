"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AuthInput, AuthSubmitButton, AuthError, AuthSuccess } from "./auth-card";

export function ResetPasswordForm() {
  const [error, setError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  if (!token) {
    return (
      <div>
        <AuthError message="Lien invalide ou expiré. Demandez un nouveau lien." />
        <Link
          href="/forgot-password"
          style={{
            display: "block",
            textAlign: "center",
            color: "var(--blue)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirm = (form.elements.namedItem("confirmPassword") as HTMLInputElement).value;

    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }

    setError(undefined);
    setLoading(true);

    const { error: authError } = await authClient.resetPassword({
      newPassword: password,
      token,
    });

    setLoading(false);

    if (authError) {
      setError("Lien expiré ou invalide. Demandez un nouveau lien.");
      return;
    }

    setSuccess("Mot de passe réinitialisé ! Redirection…");
    setTimeout(() => router.push("/login"), 1500);
  }

  if (success) {
    return <AuthSuccess message={success} />;
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <AuthError message={error} />
      <AuthInput
        label="Nouveau mot de passe"
        id="password"
        name="password"
        type="password"
        placeholder="8 caractères minimum"
        autoComplete="new-password"
        required
      />
      <AuthInput
        label="Confirmer le mot de passe"
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        placeholder="••••••••"
        autoComplete="new-password"
        required
      />
      <AuthSubmitButton label="Réinitialiser le mot de passe" loading={loading} />
    </form>
  );
}
