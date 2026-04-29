import Link from "next/link";
import { getAllPagesAdmin, seedDefaultPages, deletePage } from "@/lib/pages-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pages — Admin MS Adhésif" };

export default async function PagesListPage() {
  const allPages = await getAllPagesAdmin();

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: "0 auto", fontFamily: "var(--font-archivo), system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0A0E27" }}>Pages</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#4B5563" }}>Créez et éditez vos pages avec l'éditeur visuel</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {allPages.length === 0 && (
            <form action={async () => { "use server"; await seedDefaultPages(); }}>
              <button
                style={{ fontFamily: "var(--font-archivo)", fontSize: 12, fontWeight: 700, background: "#2563EB", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", cursor: "pointer" }}
              >
                ⚡ Initialiser Devis Pro + FAQ
              </button>
            </form>
          )}
          <Link
            href="/admin/pages/new"
            style={{ fontFamily: "var(--font-archivo)", fontSize: 12, fontWeight: 700, background: "#0A0E27", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", textDecoration: "none" }}
          >
            + Nouvelle page
          </Link>
        </div>
      </div>

      {allPages.length === 0 ? (
        <div style={{ background: "#fff", border: "2px solid #0A0E27", borderRadius: 10, padding: 40, textAlign: "center", boxShadow: "4px 4px 0 0 #0A0E27" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#0A0E27", marginBottom: 6 }}>Aucune page créée</div>
          <div style={{ fontSize: 13, color: "#4B5563", marginBottom: 20 }}>
            Initialisez les pages Devis Pro et FAQ avec leur contenu par défaut, ou créez une nouvelle page vierge.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {allPages.map((page) => (
            <div
              key={page.id}
              style={{
                background: "#fff",
                border: "2px solid #0A0E27",
                borderRadius: 8,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                boxShadow: "3px 3px 0 0 #0A0E27",
              }}
            >
              <div style={{ fontSize: 24 }}>📄</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#0A0E27", display: "flex", alignItems: "center", gap: 8 }}>
                  {page.title}
                  {!page.published && (
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", background: "#F3F4F6", color: "#9BA3AF", padding: "2px 6px", borderRadius: 4 }}>BROUILLON</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#9BA3AF", marginTop: 2 }}>
                  /{page.slug} · {Array.isArray(page.sections) ? (page.sections as unknown[]).length : 0} section(s)
                </div>
              </div>
              <Link
                href={`/${page.slug}`}
                target="_blank"
                style={{ fontSize: 11, fontWeight: 600, color: "#4B5563", border: "1.5px solid #ECEEF2", borderRadius: 6, padding: "5px 10px", textDecoration: "none" }}
              >
                Voir ↗
              </Link>
              <Link
                href={`/admin/pages/${page.id}`}
                style={{ fontSize: 11, fontWeight: 700, color: "#0A0E27", border: "1.5px solid #0A0E27", borderRadius: 6, padding: "5px 10px", textDecoration: "none" }}
              >
                Éditer ✏️
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
