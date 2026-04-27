import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Mot de passe oublié — MS Adhésif",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Mot de passe oublié"
      subtitle="Entrez votre email et nous vous enverrons un lien de réinitialisation."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
