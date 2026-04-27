import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Réinitialiser le mot de passe — MS Adhésif",
};

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Nouveau mot de passe" subtitle="Choisissez un mot de passe sécurisé.">
      {/* Suspense needed because ResetPasswordForm uses useSearchParams */}
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
