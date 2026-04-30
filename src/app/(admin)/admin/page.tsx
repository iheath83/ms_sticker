import Link from "next/link";
import { getDashboardStats } from "@/lib/admin-actions";
import { db } from "@/db";
import { orders, users } from "@/db/schema";
import { and, gte, ne, sum, count, inArray } from "drizzle-orm";
import { AdminTopbar, AdminPage, AdminCard, KpiCard, StatusBadge, T } from "@/components/admin/admin-ui";
import type { BadgeVariant } from "@/components/admin/admin-ui";

const STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  proof_pending:            { label: "Attente paiement",   variant: "warning" },
  paid:                     { label: "BAT à préparer",     variant: "purple"  },
  proof_sent:               { label: "BAT envoyé",         variant: "info"    },
  proof_revision_requested: { label: "Révision demandée",  variant: "danger"  },
  approved:                 { label: "BAT validé",         variant: "success" },
  in_production:            { label: "En production",      variant: "pink"    },
  shipped:                  { label: "Expédié",            variant: "info"    },
  delivered:                { label: "Livré",              variant: "success" },
  cancelled:                { label: "Annulé",             variant: "neutral" },
};

function euros(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function daysAgo(date: Date) {
  const diff = Date.now() - new Date(date).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "à l'instant";
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

export default async function AdminDashboardPage() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [{ byStatus, urgentOrders }, revenueRows, ordersThisMonth, newCustomers] =
    await Promise.all([
      getDashboardStats(),
      db
        .select({ total: sum(orders.totalCents) })
        .from(orders)
        .where(
          and(
            inArray(orders.status, ["shipped", "delivered"]),
            gte(orders.createdAt, startOfMonth),
          ),
        ),
      db
        .select({ n: count() })
        .from(orders)
        .where(and(ne(orders.status, "draft"), gte(orders.createdAt, startOfMonth))),
      db
        .select({ n: count() })
        .from(users)
        .where(gte(users.createdAt, startOfMonth)),
    ]);

  const revenueCents = Number(revenueRows[0]?.total ?? 0);
  const ordersCount  = Number(ordersThisMonth[0]?.n ?? 0);
  const clientsCount = Number(newCustomers[0]?.n ?? 0);
  const totalOrders  = Object.values(byStatus).reduce((a, b) => a + b, 0);

  const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(new Date());

  return (
    <>
      <AdminTopbar title="Dashboard" subtitle={`${totalOrders} commandes actives`} />

      <AdminPage>
        {/* KPI row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <KpiCard
            label={`CA ${monthLabel}`}
            value={euros(revenueCents)}
            sub="Commandes expédiées & livrées"
            href="/admin/orders?status=delivered"
            accent={T.success}
          />
          <KpiCard
            label={`Commandes ${monthLabel}`}
            value={ordersCount}
            sub="Toutes sauf brouillons"
            href="/admin/orders"
          />
          <KpiCard
            label={`Nouveaux clients ${monthLabel}`}
            value={clientsCount}
            sub="Comptes créés ce mois"
            href="/admin/customers"
          />
        </div>

        {/* Status grid */}
        <div style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: T.textSecondary,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 12,
              marginTop: 0,
            }}
          >
            Commandes par statut
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 12,
            }}
          >
            {Object.entries(STATUS_META).map(([status, meta]) => {
              const n = byStatus[status] ?? 0;
              return (
                <Link key={status} href={`/admin/orders?status=${status}`} style={{ textDecoration: "none" }}>
                  <AdminCard
                    padding="14px 18px"
                    style={{
                      opacity: n === 0 ? 0.5 : 1,
                      transition: "box-shadow 0.15s, opacity 0.15s",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 26,
                        fontWeight: 800,
                        color: n > 0 ? T.textPrimary : T.textDisabled,
                        letterSpacing: "-0.03em",
                        lineHeight: 1,
                        marginBottom: 8,
                      }}
                    >
                      {n}
                    </div>
                    <StatusBadge label={meta.label} variant={meta.variant} dot={false} />
                  </AdminCard>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Urgent orders */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <h2
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: T.textSecondary,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                margin: 0,
              }}
            >
              Action requise
            </h2>
            <Link href="/admin/orders?status=paid" style={{ fontSize: 12, color: T.textSecondary, textDecoration: "underline" }}>
              Voir tout
            </Link>
          </div>

          {urgentOrders.length === 0 ? (
            <AdminCard padding="40px 24px" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                Aucune action requise
              </div>
              <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>
                Toutes les commandes sont à jour.
              </div>
            </AdminCard>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {urgentOrders.map((o) => {
                const isPaid = o.status === "paid";
                return (
                  <Link key={o.id} href={`/admin/orders/${o.id}`} style={{ textDecoration: "none" }}>
                    <AdminCard
                      padding="14px 20px"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 16,
                        borderLeft: `3px solid ${isPaid ? "#8B5CF6" : T.danger}`,
                        transition: "box-shadow 0.15s",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 11,
                            fontFamily: "monospace",
                            color: T.textSecondary,
                            marginBottom: 2,
                          }}
                        >
                          #{o.id.slice(0, 8).toUpperCase()}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: T.textPrimary }}>
                          {o.customerName ?? o.customerEmail ?? o.guestEmail ?? "Client invité"}
                        </div>
                        <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
                          {daysAgo(o.createdAt)}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 16, color: T.textPrimary, fontFamily: "monospace" }}>
                          {euros(o.totalCents)}
                        </div>
                        <StatusBadge
                          label={isPaid ? "BAT à préparer" : "Révision demandée"}
                          variant={isPaid ? "purple" : "danger"}
                        />
                      </div>
                    </AdminCard>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </AdminPage>
    </>
  );
}
