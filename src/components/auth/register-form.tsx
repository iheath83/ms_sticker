"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AuthInput, AuthSubmitButton, AuthError, AuthSuccess } from "./auth-card";

export function RegisterForm() {
  const [error, setError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirm = (form.elements.namedItem("confirmPassword") as HTMLInputElement).value;

    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setError(undefined);
    setLoading(true);

    const { error: authError } = await authClient.signUp.email({
      name,
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      const msg = authError.message ?? "";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exist")) {
        setError("Un compte existe déjà avec cet email");
      } else {
        setError("Erreur lors de l'inscription, veuillez réessayer");
      }
      return;
    }

    setSuccess("Compte créé ! Redirection…");
    setTimeout(() => {
      router.push("/account");
      router.refresh();
    }, 800);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <AuthSuccess message={success} />
      <AuthError message={error} />
      <AuthInput
        label="Prénom et nom"
        id="name"
        name="name"
        placeholder="Jean Dupont"
        autoComplete="name"
        required
      />
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
      <div style={{ marginTop: 4, marginBottom: 20 }}>
        <AuthSubmitButton label="Créer mon compte" loading={loading} />
      </div>
      <p style={{ textAlign: "center", fontSize: 13, color: "var(--grey-600)" }}>
        Déjà un compte ?{" "}
        <Link href="/login" style={{ color: "var(--blue)", fontWeight: 600, textDecoration: "none" }}>
          Se connecter
        </Link>
      </p>
    </form>
  );
}
