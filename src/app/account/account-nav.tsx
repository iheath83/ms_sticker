"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/account/orders", label: "Mes commandes", icon: "📦" },
  { href: "/account/invoices", label: "Mes factures", icon: "🧾" },
  { href: "/account/addresses", label: "Mes adresses", icon: "📍" },
  { href: "/account/profile", label: "Mon compte", icon: "👤" },
];

interface Props {
  user: { name: string | null; email: string };
}

export default function AccountNav({ user }: Props) {
  const pathname = usePathname();

  return (
    <div style={{
      background: "var(--white)",
      borderBottom: "2px solid var(--ink)",
    }}>
      <div style={{
        maxWidth: 1100, margin: "0 auto", padding: "0 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 24, flexWrap: "wrap",
      }}>
        {/* Left: title + nav tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          <div style={{ paddingRight: 24, marginRight: 8, borderRight: "1px solid var(--grey-200)" }}>
            <div style={{ fontSize: 11, color: "var(--red)", fontWeight: 700, letterSpacing: "0.12em" }}>◆ ESPACE CLIENT</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>
              {user.name ?? user.email}
            </div>
          </div>
          <nav style={{ display: "flex" }}>
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "18px 18px",
                    fontSize: 13, fontWeight: 700,
                    fontFamily: "var(--font-mono), monospace",
                    color: active ? "var(--red)" : "var(--grey-600)",
                    textDecoration: "none",
                    borderBottom: active ? "2px solid var(--red)" : "2px solid transparent",
                    marginBottom: -2,
                    transition: "color 0.15s",
                  }}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: email */}
        <div style={{ fontSize: 12, color: "var(--grey-400)", fontFamily: "var(--font-mono), monospace", paddingRight: 4 }}>
          {user.email}
        </div>
      </div>
    </div>
  );
}
