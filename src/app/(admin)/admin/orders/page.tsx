import Link from "next/link";
import { getAdminOrders } from "@/lib/admin-actions";
import {
  AdminTopbar,
  AdminPage,
  AdminTableWrapper,
  AdminTableHead,
  AdminEmptyState,
  StatusBadge,
  T,
} from "@/components/admin/admin-ui";
import type { BadgeVariant } from "@/components/admin/admin-ui";

const STATUS_TABS: Array<{ key: string; label: string }> = [
  { key: "all",                     label: "Toutes" },
  { key: "paid",                    label: "BAT à faire" },
  { key: "proof_sent",              label: "BAT envoyé" },
  { key: "proof_revision_requested",label: "Révision" },
  { key: "approved",                label: "BAT validé" },
  { key: "in_production",           label: "Production" },
  { key: "shipped",                 label: "Expédié" },
  { key: "delivered",               label: "Livré" },
  { key: "proof_pending",           label: "Attente paiement" },
  { key: "cancelled",               label: "Annulé" },
];

const STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  proof_pending:            { label: "Attente paiement",  variant: "warning" },
  paid:                     { label: "BAT à préparer",    variant: "purple"  },
  proof_sent:               { label: "BAT envoyé",        variant: "info"    },
  proof_revision_requested: { label: "Révision demandée", variant: "danger"  },
  approved:                 { label: "BAT validé",        variant: "success" },
  in_production:            { label: "En production",     variant: "pink"    },
  shipped:                  { label: "Expédié",           variant: "info"    },
  delivered:                { label: "Livré",             variant: "success" },
  cancelled:                { label: "Annulé",            variant: "neutral" },
};

function euros(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const currentStatus = params.status ?? "all";
  const orders = await getAdminOrders(currentStatus);

  return (
    <>
      <AdminTopbar title="Commandes" subtitle={`${orders.length} résultat${orders.length > 1 ? "s" : ""}`} />

      <AdminPage>
        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 2,
            flexWrap: "wrap",
            marginBottom: 20,
            background: T.surface,
            padding: "4px",
            borderRadius: T.radius,
            border: `1.5px solid ${T.border}`,
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          {STATUS_TABS.map(({ key, label }) => {
            const active = currentStatus === key;
            return (
              <Link
                key={key}
                href={`/admin/orders${key === "all" ? "" : `?status=${key}`}`}
                style={{
                  padding: "7px 14px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  textDecoration: "none",
                  background: active ? T.brand : "transparent",
                  color: active ? "#fff" : T.textSecondary,
                  transition: "background 0.15s, color 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Table */}
        <AdminTableWrapper>
          {orders.length === 0 ? (
            <AdminEmptyState icon="📦" title="Aucune commande" subtitle="Aucune commande ne correspond à ce filtre." />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <AdminTableHead cols={["#Référence", "Client", "Articles", "Total", "Statut", "Date", ""]} />
              <tbody>
                {orders.map((order, i) => {
                  const meta = STATUS_META[order.status];
                  const customer = order.customerName ?? order.customerEmail ?? order.guestEmail ?? "Invité";
                  return (
                    <tr
                      key={order.id}
                      style={{
                        borderBottom: i < orders.length - 1 ? `1px solid ${T.borderSubtle}` : "none",
                      }}
                      className="admin-table-row"
                    >
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 12, color: T.textSecondary, fontWeight: 600 }}>
                          #{order.id.slice(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: T.textPrimary }}>{customer}</div>
                        {order.guestEmail && !order.customerEmail && (
                          <div style={{ fontSize: 11, color: T.textSecondary }}>Invité</div>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", color: T.textSecondary, fontSize: 13 }}>
                        {order.itemCount} article{order.itemCount > 1 ? "s" : ""}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: T.textPrimary, fontFamily: "monospace" }}>
                          {euros(order.totalCents)}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {meta && <StatusBadge label={meta.label} variant={meta.variant} />}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 12, color: T.textSecondary, whiteSpace: "nowrap" }}>
                        {formatDate(order.createdAt)}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <Link
                          href={`/admin/orders/${order.id}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "6px 12px",
                            borderRadius: T.radiusSm,
                            background: T.brand,
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          Détail →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </AdminTableWrapper>
      </AdminPage>
    </>
  );
}
