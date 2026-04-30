import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { AdminBypassCookieSetter } from "@/components/admin/admin-bypass-cookie-setter";
import { T } from "@/components/admin/admin-ui";

export const dynamic = "force-dynamic";

const NAV_SECTIONS = [
  {
    label: "Ventes",
    items: [
      { href: "/admin/orders",    label: "Commandes",   icon: "📦" },
      { href: "/admin/customers", label: "Clients",     icon: "👥" },
      { href: "/admin/reviews",   label: "Avis clients",icon: "⭐" },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/admin/products",  label: "Produits",         icon: "🏷️" },
      { href: "/admin/categories",label: "Catégories",       icon: "🗂️" },
      { href: "/admin/options",   label: "Options produit",  icon: "⚙️" },
    ],
  },
  {
    label: "Contenu",
    items: [
      { href: "/admin/pages",      label: "Pages",      icon: "📄" },
      { href: "/admin/navigation", label: "Navigation", icon: "🧭" },
      { href: "/admin/emails",     label: "Emails",     icon: "📧" },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/admin/discounts", label: "Réductions", icon: "🏷️" },
      { href: "/admin/settings",  label: "Paramètres", icon: "🛠️" },
    ],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "admin") redirect("/");

  const initials = (session.user.name ?? session.user.email ?? "A")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        height: "100vh",
        overflow: "hidden",
        background: T.bg,
        fontFamily: "var(--font-archivo), system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ── Sidebar ── */}
      <aside
        style={{
          background: T.surface,
          borderRight: `1.5px solid ${T.border}`,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflowY: "auto",
          position: "sticky",
          top: 0,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: "18px 20px 16px",
            borderBottom: `1.5px solid ${T.border}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Link
            href="/admin"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              textDecoration: "none",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                background: T.brand,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 900,
                color: "#fff",
                letterSpacing: "-0.02em",
                flexShrink: 0,
              }}
            >
              MS
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.textPrimary, letterSpacing: "-0.01em" }}>
                MS Adhésif
              </div>
              <div style={{ fontSize: 10, color: T.textSecondary, fontWeight: 500, letterSpacing: "0.04em" }}>
                Administration
              </div>
            </div>
          </Link>
        </div>

        {/* Dashboard link */}
        <div style={{ padding: "8px 10px 4px" }}>
          <Link
            href="/admin"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: T.radiusSm,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 600,
              color: T.textPrimary,
            }}
            className="admin-nav-link"
          >
            <span style={{ fontSize: 15 }}>⬛</span>
            Dashboard
          </Link>
        </div>

        {/* Navigation sections */}
        <nav style={{ padding: "4px 10px", flex: 1 }}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} style={{ marginBottom: 4 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: T.textSecondary,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  padding: "12px 10px 4px",
                }}
              >
                {section.label}
              </div>
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: T.radiusSm,
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 500,
                    color: T.textPrimary,
                    marginBottom: 1,
                  }}
                  className="admin-nav-link"
                >
                  <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* User panel */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: `1.5px solid ${T.border}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: T.brandLight,
              color: T.brand,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {session.user.name ?? session.user.email}
            </div>
            <Link
              href="/"
              style={{ fontSize: 11, color: T.textSecondary, textDecoration: "none" }}
            >
              ← Retour au site
            </Link>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "auto" }}>
        <AdminBypassCookieSetter />
        {children}
      </div>
    </div>
  );
}
