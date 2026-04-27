"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { AuthInput, AuthSubmitButton, AuthError, AuthSuccess } from "./auth-card";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;

    if (!email) {
      setError("Email invalide");
      return;
    }

    setError(undefined);
    setLoading(true);

    await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    // Always show success to avoid email enumeration
    setSuccess(
      `Si un compte existe pour ${email}, un lien de réinitialisation a été envoyé. Vérifiez votre boîte mail.`,
    );
  }

  if (success) {
    return (
      <div>
        <AuthSuccess message={success} />
        <Link
          href="/login"
          style={{
            display: "block",
            textAlign: "center",
            marginTop: 16,
            fontSize: 13,
            color: "var(--blue)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          ← Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <AuthError message={error} />
      <AuthInput
        label="Email"
        id="email"
        name="email"
        type="email"
        placeholder="vous@exemple.fr"
        autoComplete="email"
        required
      />
      <AuthSubmitButton label="Envoyer le lien" loading={loading} />
      <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--grey-600)" }}>
        <Link href="/login" style={{ color: "var(--blue)", textDecoration: "none" }}>
          ← Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
