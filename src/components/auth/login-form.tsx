"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AuthInput, AuthSubmitButton, AuthError } from "./auth-card";

export function LoginForm() {
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/account";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    setError(undefined);
    setLoading(true);

    const { error: authError } = await authClient.signIn.email({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError("Email ou mot de passe incorrect");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
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
      <AuthInput
        label="Mot de passe"
        id="password"
        name="password"
        type="password"
        placeholder="••••••••"
        autoComplete="current-password"
        required
      />
      <div style={{ marginBottom: 20, textAlign: "right" }}>
        <Link
          href="/forgot-password"
          style={{ fontSize: 12, color: "var(--blue)", textDecoration: "none" }}
        >
          Mot de passe oublié ?
        </Link>
      </div>
      <AuthSubmitButton label="Se connecter" loading={loading} />
      <p
        style={{
          textAlign: "center",
          marginTop: 20,
          fontSize: 13,
          color: "var(--grey-600)",
        }}
      >
        Pas encore de compte ?{" "}
        <Link href="/register" style={{ color: "var(--blue)", fontWeight: 600, textDecoration: "none" }}>
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
