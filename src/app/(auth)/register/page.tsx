import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Créer un compte — MS Adhésif",
};

export default function RegisterPage() {
  return (
    <AuthCard
      title="Créer un compte"
      subtitle="Suivez vos commandes et gérez vos fichiers en toute simplicité."
    >
      <RegisterForm />
    </AuthCard>
  );
}
