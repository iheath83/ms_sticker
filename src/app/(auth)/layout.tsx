import Link from "next/link";
import { Logo } from "@/components/shop/logo";
import { getSiteSettings } from "@/lib/settings-actions";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--cream)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <Link href="/" style={{ textDecoration: "none", marginBottom: 40 }}>
        <Logo imageUrl={settings.logoUrl} />
      </Link>
      {children}
      <p
        style={{
          marginTop: 32,
          fontSize: 11,
          color: "var(--grey-400)",
          fontFamily: "var(--font-archivo), system-ui, sans-serif",
          letterSpacing: "0.05em",
        }}
      >
        © {new Date().getFullYear()} MS Adhésif · Tous droits réservés
      </p>
    </div>
  );
}
