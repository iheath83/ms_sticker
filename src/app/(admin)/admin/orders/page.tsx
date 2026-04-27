import Link from "next/link";
import { getAdminOrders } from "@/lib/admin-actions";

const STATUS_LABELS: Record<string, string> = {
  all: "Toutes",
  paid: "Payés — BAT à faire",
  proof_sent: "BAT envoyé",
  proof_revision_requested: "Révision",
  approved: "BAT validé",
  in_production: "Production",
  shipped: "Expédié",
  delivered: "Livré",
  proof_pending: "Attente paiement",
  cancelled: "Annulé",
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
    <main style={{ padding: "32px 40px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: "var(--font-archivo), system-ui, sans-serif",
            fontSize: 28,
            fontWeight: 900,
            color: "#0A0E27",
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          Commandes
        </h1>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 24,
          background: "#fff",
          padding: "12px 16px",
          borderRadius: 10,
          border: "1px solid #E5E7EB",
        }}
      >
        {Object.entries(STATUS_LABELS).map(([status, label]) => {
          const active = currentStatus === status;
          return (
            <Link
              key={status}
              href={`/admin/orders${status === "all" ? "" : `?status=${status}`}`}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                textDecoration: "none",
                background: active ? "#0A0E27" : "#F3F4F6",
                color: active ? "#fff" : "#374151",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                transition: "background 0.15s",
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Table */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {orders.length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              color: "#9CA3AF",
              fontSize: 14,
            }}
          >
            Aucune commande trouvée
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                {["#ID", "Client", "Articles", "Total", "Statut", "Date", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#6B7280",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order, i) => {
                const sc = STATUS_COLORS[order.status] ?? { bg: "#F3F4F6", text: "#6B7280" };
                const customer =
                  order.customerName ??
                  order.customerEmail ??
                  order.guestEmail ??
                  "Invité";
                return (
                  <tr
                    key={order.id}
                    style={{
                      borderBottom:
                        i < orders.length - 1 ? "1px solid #F3F4F6" : "none",
                    }}
                  >
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-mono), monospace",
                          fontSize: 12,
                          color: "#6B7280",
                        }}
                      >
                        #{order.id.slice(0, 8).toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#0A0E27" }}>
                        {customer}
                      </div>
                      {order.guestEmail && !order.customerEmail && (
                        <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                          {order.guestEmail} (invité)
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#374151", fontSize: 13 }}>
                      {order.itemCount} article{order.itemCount > 1 ? "s" : ""}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          color: "#0A0E27",
                          fontFamily: "var(--font-mono), monospace",
                        }}
                      >
                        {euros(order.totalCents)}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          background: sc.bg,
                          color: sc.text,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "14px 16px",
                        fontSize: 12,
                        color: "#9CA3AF",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(order.createdAt)}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        style={{
                          display: "inline-block",
                          padding: "6px 14px",
                          borderRadius: 6,
                          background: "#0A0E27",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 700,
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
      </div>
    </main>
  );
}
