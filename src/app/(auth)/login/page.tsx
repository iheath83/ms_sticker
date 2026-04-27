import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Connexion — MS Adhésif",
};

export default function LoginPage() {
  return (
    <AuthCard
      title="Connexion"
      subtitle="Accédez à votre espace client pour suivre vos commandes."
    >
      <LoginForm />
    </AuthCard>
  );
}
