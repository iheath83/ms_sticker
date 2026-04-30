import Link from "next/link";
import { db } from "@/db";
import { shippingMethods, shippingZones, shippingRules } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import {
  AdminTopbar,
  AdminPage,
  KpiCard,
  PrimaryBtn,
  SectionTitle,
} from "@/components/admin/admin-ui";

export const dynamic = "force-dynamic";

export default async function ShippingDashboardPage() {
  const [methodsResult, zonesResult, rulesResult, activeMethodsResult, activeRulesResult] =
    await Promise.all([
      db.select({ count: count() }).from(shippingMethods),
      db.select({ count: count() }).from(shippingZones),
      db.select({ count: count() }).from(shippingRules),
      db.select({ count: count() }).from(shippingMethods).where(eq(shippingMethods.isActive, true)),
      db.select({ count: count() }).from(shippingRules).where(eq(shippingRules.isActive, true)),
    ]);

  const totalMethods = methodsResult[0]?.count ?? 0;
  const totalZones = zonesResult[0]?.count ?? 0;
  const totalRules = rulesResult[0]?.count ?? 0;
  const activeMethods = activeMethodsResult[0]?.count ?? 0;
  const activeRules = activeRulesResult[0]?.count ?? 0;

  const quickLinks = [
    { href: "/admin/shipping/methods", label: "Méthodes de livraison", icon: "🚚", desc: "Créer et gérer vos options de livraison" },
    { href: "/admin/shipping/zones", label: "Zones de livraison", icon: "🗺️", desc: "Définir les zones géographiques" },
    { href: "/admin/shipping/rules", label: "Règles d'expédition", icon: "⚙️", desc: "Créer des règles conditionnelles" },
    { href: "/admin/shipping/simulate", label: "Simulateur", icon: "🧪", desc: "Tester vos règles sur un panier" },
    { href: "/admin/shipping/pickup", label: "Points de retrait", icon: "🏪", desc: "Gérer les points de retrait magasin" },
    { href: "/admin/shipping/calendar", label: "Dates & Créneaux", icon: "📅", desc: "Gérer les créneaux et jours bloqués" },
  ];

  return (
    <>
      <AdminTopbar title="Expédition" subtitle="Moteur de livraison avancé">
        <Link href="/admin/shipping/rules">
          <PrimaryBtn>+ Nouvelle règle</PrimaryBtn>
        </Link>
      </AdminTopbar>

      <AdminPage>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
          <KpiCard label="Méthodes actives" value={String(activeMethods)} sub={`sur ${totalMethods} au total`} />
          <KpiCard label="Règles actives" value={String(activeRules)} sub={`sur ${totalRules} au total`} />
          <KpiCard label="Zones configurées" value={String(totalZones)} />
          <KpiCard label="Méthodes inactives" value={String(Number(totalMethods) - Number(activeMethods))} />
        </div>

        <SectionTitle>Navigation rapide</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href} className="shipping-quick-link">
              <div className="shipping-quick-card">
                <div style={{ fontSize: 28, marginBottom: 8 }}>{link.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{link.label}</div>
                <div style={{ fontSize: 12, opacity: 0.6 }}>{link.desc}</div>
              </div>
            </Link>
          ))}
        </div>
        <style>{`
          .shipping-quick-link { text-decoration: none; display: block; }
          .shipping-quick-card {
            background: #fff;
            border: 1.5px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            cursor: pointer;
            transition: border-color 0.15s, box-shadow 0.15s;
            color: #111;
          }
          .shipping-quick-card:hover {
            border-color: #2563eb;
            box-shadow: 0 2px 8px rgba(37,99,235,0.08);
          }
        `}</style>
      </AdminPage>
    </>
  );
}
