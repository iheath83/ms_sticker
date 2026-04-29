import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { AdminBypassCookieSetter } from "@/components/admin/admin-bypass-cookie-setter";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "⬛" },
  { href: "/admin/orders", label: "Commandes", icon: "📦" },
  { href: "/admin/customers", label: "Clients", icon: "👥" },
  { href: "/admin/categories", label: "Catégories", icon: "🗂️" },
  { href: "/admin/products", label: "Produits", icon: "🏷️" },
  { href: "/admin/options", label: "Options produit", icon: "⚙️" },
  { href: "/admin/navigation", label: "Navigation", icon: "🧭" },
  { href: "/admin/emails", label: "Emails", icon: "📧" },
  { href: "/admin/settings", label: "Paramètres", icon: "🛠️" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session || role !== "admin") redirect("/");

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        height: "100vh",
        overflow: "hidden",
        background: "#F5F2EC",
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          background: "#0A0E27",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          borderRight: "2px solid #1a1f3e",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
        }}
      >
        {/* Logo */}
        <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <Link
            href="/admin"
            style={{
              fontFamily: "var(--font-archivo), system-ui, sans-serif",
              fontSize: 18,
              fontWeight: 900,
              color: "#fff",
              textDecoration: "none",
              letterSpacing: "-0.02em",
            }}
          >
            MS<span style={{ color: "#DC2626" }}>◆</span> Admin
          </Link>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4, fontFamily: "monospace", letterSpacing: "0.1em" }}>
            BACK-OFFICE
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ padding: "16px 12px", flex: 1 }}>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 8,
                color: "rgba(255,255,255,0.75)",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "var(--font-archivo), system-ui, sans-serif",
                marginBottom: 2,
                transition: "background 0.15s, color 0.15s",
              }}
              className="admin-nav-link"
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            fontSize: 12,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          <div style={{ fontWeight: 600, color: "rgba(255,255,255,0.8)", marginBottom: 2 }}>
            {session.user.name ?? session.user.email}
          </div>
          <div style={{ fontSize: 10, letterSpacing: "0.1em", color: "#DC2626", fontFamily: "monospace" }}>
            ◆ ADMINISTRATEUR
          </div>
          <Link
            href="/"
            style={{ display: "block", marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.4)", textDecoration: "underline" }}
          >
            ← Retour au site
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "auto" }}>
        <AdminBypassCookieSetter />
        {children}
      </div>
    </div>
  );
}
