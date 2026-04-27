import { notFound } from "next/navigation";
import Link from "next/link";
import { getCustomerDetail } from "@/lib/admin-actions";

const STATUS_LABELS: Record<string, string> = {
  proof_pending: "BAT en attente",
  proof_sent: "BAT envoyé",
  proof_revision_requested: "Révision",
  approved: "Approuvé",
  paid: "Payé",
  in_production: "Production",
  shipped: "Expédié",
  delivered: "Livré",
  cancelled: "Annulé",
  draft: "Brouillon",
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  proof_pending:            { bg: "#FEF3C7", text: "#92400E" },
  proof_sent:               { bg: "#DBEAFE", text: "#1E40AF" },
  proof_revision_requested: { bg: "#FEE2E2", text: "#991B1B" },
  approved:                 { bg: "#D1FAE5", text: "#065F46" },
  paid:                     { bg: "#EDE9FE", text: "#5B21B6" },
  in_production:            { bg: "#FCE7F3", text: "#9D174D" },
  shipped:                  { bg: "#CFFAFE", text: "#164E63" },
  delivered:                { bg: "#DCFCE7", text: "#14532D" },
  cancelled:                { bg: "#F3F4F6", text: "#6B7280" },
  draft:                    { bg: "#F3F4F6", text: "#9CA3AF" },
};

function euros(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getCustomerDetail(id);
  if (!detail) notFound();

  const { user, orders } = detail;
  const totalSpent = orders
    .filter((o) => o.status !== "draft" && o.status !== "cancelled")
    .reduce((sum, o) => sum + o.totalCents, 0);

  return (
    <main style={{ padding: "32px 40px" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 20, fontSize: 13, color: "#9CA3AF" }}>
        <Link href="/admin/customers" style={{ color: "#6B7280", textDecoration: "underline" }}>
          Clients
        </Link>
        {" / "}
        <span>{user.name ?? user.email}</span>
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <h1
            style={{
              fontFamily: "var(--font-archivo), system-ui, sans-serif",
              fontSize: 24,
              fontWeight: 900,
              color: "#0A0E27",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            {user.name ?? "Sans nom"}
          </h1>
          <div style={{ marginTop: 6, fontSize: 14, color: "#6B7280" }}>{user.email}</div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#9CA3AF" }}>
            Inscrit le {formatDate(user.createdAt)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#0A0E27", fontFamily: "monospace" }}>
            {euros(totalSpent)}
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>dépensé au total</div>
        </div>
      </div>

      {/* Orders */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB" }}>
          <h2 style={{ fontFamily: "var(--font-archivo), system-ui, sans-serif", fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: 0 }}>
            Historique des commandes ({orders.length})
          </h2>
        </div>
        {orders.length === 0 ? (
          <div style={{ padding: "32px 24px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
            Aucune commande
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                {["#ID", "Date", "Statut", "Total", ""].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order, i) => {
                const sc = STATUS_COLORS[order.status] ?? { bg: "#F3F4F6", text: "#6B7280" };
                return (
                  <tr key={order.id} style={{ borderBottom: i < orders.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                    <td style={{ padding: "14px 16px", fontFamily: "monospace", fontSize: 12, color: "#6B7280" }}>
                      #{order.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "#374151" }}>
                      {formatDate(order.createdAt)}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.text, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: "#0A0E27" }}>
                      {euros(order.totalCents)}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        style={{ fontSize: 12, color: "#6B7280", textDecoration: "underline" }}
                      >
                        Voir →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
