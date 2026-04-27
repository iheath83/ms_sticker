import Link from "next/link";
import { Logo } from "@/components/shop/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
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
        <Logo />
      </Link>
      {children}
      <p
        style={{
          marginTop: 32,
          fontSize: 11,
          color: "var(--grey-400)",
          fontFamily: "var(--font-mono), monospace",
          letterSpacing: "0.05em",
        }}
      >
        © {new Date().getFullYear()} MS Adhésif · Tous droits réservés
      </p>
    </div>
  );
}
