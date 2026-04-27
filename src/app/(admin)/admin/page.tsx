import Link from "next/link";
import { getDashboardStats } from "@/lib/admin-actions";

const STATUS_LABELS: Record<string, string> = {
  proof_pending: "Attente paiement",
  paid: "Payé — BAT à préparer",
  proof_sent: "BAT envoyé",
  proof_revision_requested: "Révision demandée",
  approved: "BAT validé",
  in_production: "En production",
  shipped: "Expédié",
  delivered: "Livré",
  cancelled: "Annulé",
};

const STATUS_COLORS: Record<string, string> = {
  proof_pending: "#F59E0B",
  proof_sent: "#3B82F6",
  proof_revision_requested: "#EF4444",
  approved: "#10B981",
  paid: "#8B5CF6",
  in_production: "#EC4899",
  shipped: "#06B6D4",
  delivered: "#22C55E",
  cancelled: "#6B7280",
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
  const { byStatus, urgentOrders } = await getDashboardStats();

  const totalOrders = Object.values(byStatus).reduce((a, b) => a + b, 0);

  return (
    <main style={{ padding: "32px 40px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
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
          Dashboard
        </h1>
        <p style={{ color: "#6B7280", fontSize: 14, marginTop: 4 }}>
          Vue d&apos;ensemble — {totalOrders} commandes actives
        </p>
      </div>

      {/* Stats cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 40,
        }}
      >
        {Object.entries(STATUS_LABELS).map(([status, label]) => {
          const n = byStatus[status] ?? 0;
          const color = STATUS_COLORS[status] ?? "#6B7280";
          return (
            <Link
              key={status}
              href={`/admin/orders?status=${status}`}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  background: "#fff",
                  border: `1px solid ${n > 0 ? color : "#E5E7EB"}`,
                  borderLeft: `4px solid ${color}`,
                  borderRadius: 10,
                  padding: "16px 20px",
                  transition: "box-shadow 0.15s",
                }}
              >
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: n > 0 ? color : "#D1D5DB",
                    fontFamily: "var(--font-mono), monospace",
                    lineHeight: 1,
                  }}
                >
                  {n}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#6B7280",
                    marginTop: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {label}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Urgent section: paid orders needing BAT + revision requests */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-archivo), system-ui, sans-serif",
              fontSize: 16,
              fontWeight: 800,
              color: "#0A0E27",
              margin: 0,
            }}
          >
            ⚡ Action requise
          </h2>
          <Link
            href="/admin/orders?status=paid"
            style={{ fontSize: 12, color: "#6B7280", textDecoration: "underline" }}
          >
            Voir tout
          </Link>
        </div>

        {urgentOrders.length === 0 ? (
          <div
            style={{
              background: "#fff",
              border: "1px solid #E5E7EB",
              borderRadius: 10,
              padding: "32px 24px",
              textAlign: "center",
              color: "#9CA3AF",
              fontSize: 14,
            }}
          >
            Aucune action requise 🎉
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {urgentOrders.map((o) => {
              const isPaid = o.status === "paid";
              const accentColor = isPaid ? "#8B5CF6" : "#EF4444";
              const borderColor = isPaid ? "#C4B5FD" : "#FCA5A5";
              const actionLabel = isPaid ? "Préparer le BAT →" : "Révision demandée →";
              return (
                <Link
                  key={o.id}
                  href={`/admin/orders/${o.id}`}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={{
                      background: "#fff",
                      border: `1px solid ${borderColor}`,
                      borderLeft: `4px solid ${accentColor}`,
                      borderRadius: 10,
                      padding: "14px 20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: "var(--font-mono), monospace",
                          fontSize: 11,
                          color: "#6B7280",
                          marginBottom: 2,
                        }}
                      >
                        #{o.id.slice(0, 8).toUpperCase()}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0A0E27" }}>
                        {o.customerName ?? o.customerEmail ?? o.guestEmail ?? "Client invité"}
                      </div>
                      <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                        {daysAgo(o.createdAt)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: 16,
                          color: "#0A0E27",
                          fontFamily: "var(--font-mono), monospace",
                        }}
                      >
                        {euros(o.totalCents)}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: accentColor,
                          marginTop: 4,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {actionLabel}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
