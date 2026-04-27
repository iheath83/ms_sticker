import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { queryMyInvoices } from "@/server/queries/orders";

function euros(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(
    new Date(d),
  );
}

const STATUS_LABEL: Record<string, string> = {
  paid: "Payée",
  in_production: "En production",
  shipped: "Expédiée",
  delivered: "Livrée",
};

export default async function InvoicesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const invoices = await queryMyInvoices(session.user.id);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 900,
          fontFamily: "var(--font-mono), monospace",
          letterSpacing: "-0.03em",
          color: "var(--ink)",
          marginBottom: 8,
        }}
      >
        MES FACTURES
      </h1>
      <p style={{ fontSize: 13, color: "var(--grey-500)", marginBottom: 32 }}>
        Factures émises par Pennylane pour vos commandes payées.
      </p>

      {invoices.length === 0 ? (
        <div
          style={{
            border: "2px dashed var(--grey-200)",
            borderRadius: 8,
            padding: "48px 24px",
            textAlign: "center",
            color: "var(--grey-400)",
            fontSize: 14,
          }}
        >
          Aucune facture disponible pour le moment.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {invoices.map((inv) => (
            <div
              key={inv.orderId}
              style={{
                border: "2px solid var(--ink)",
                borderRadius: 8,
                padding: "20px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                background: "var(--white)",
              }}
            >
              {/* Left: order info */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      fontFamily: "var(--font-mono), monospace",
                      letterSpacing: "0.08em",
                      color: "var(--red)",
                    }}
                  >
                    #{inv.orderId.slice(0, 8).toUpperCase()}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 99,
                      background: "var(--grey-100)",
                      color: "var(--grey-600)",
                      fontFamily: "var(--font-mono), monospace",
                    }}
                  >
                    {STATUS_LABEL[inv.status] ?? inv.status}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--grey-500)" }}>
                  {formatDate(inv.createdAt)}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>
                  {euros(inv.totalCents)}
                </div>
              </div>

              {/* Right: download */}
              <div>
                {inv.pennylaneInvoiceUrl ? (
                  <a
                    href={inv.pennylaneInvoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "10px 20px",
                      background: "var(--ink)",
                      color: "var(--white)",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: "var(--font-mono), monospace",
                      textDecoration: "none",
                      letterSpacing: "0.04em",
                    }}
                  >
                    ↓ Télécharger PDF
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--grey-400)" }}>
                    Facture en cours de génération…
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
