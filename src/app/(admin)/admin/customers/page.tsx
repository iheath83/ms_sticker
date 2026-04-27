import Link from "next/link";
import { db } from "@/db";
import { users, orders } from "@/db/schema";
import { eq, desc, count, ne } from "drizzle-orm";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export default async function AdminCustomersPage() {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(200);

  // Get order counts per user
  const orderCounts = await db
    .select({ userId: orders.userId, count: count() })
    .from(orders)
    .where(ne(orders.status, "draft"))
    .groupBy(orders.userId);

  const countMap = new Map(orderCounts.map((r) => [r.userId, Number(r.count)]));

  return (
    <main style={{ padding: "32px 40px" }}>
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
          Clients
        </h1>
        <p style={{ color: "#6B7280", fontSize: 14, marginTop: 4 }}>
          {rows.length} compte{rows.length > 1 ? "s" : ""} enregistré{rows.length > 1 ? "s" : ""}
        </p>
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
              {["Nom", "Email", "Rôle", "Commandes", "Inscrit le", ""].map((h) => (
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
            {rows.map((user, i) => (
              <tr
                key={user.id}
                style={{ borderBottom: i < rows.length - 1 ? "1px solid #F3F4F6" : "none" }}
              >
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#0A0E27" }}>
                    {user.name ?? "—"}
                  </div>
                </td>
                <td style={{ padding: "14px 16px", fontSize: 13, color: "#374151" }}>
                  {user.email}
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <span
                    style={{
                      padding: "3px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      background: user.role === "admin" ? "#FEE2E2" : "#F3F4F6",
                      color: user.role === "admin" ? "#991B1B" : "#6B7280",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {user.role ?? "user"}
                  </span>
                </td>
                <td style={{ padding: "14px 16px", fontSize: 13, color: "#374151" }}>
                  {countMap.get(user.id) ?? 0}
                </td>
                <td style={{ padding: "14px 16px", fontSize: 12, color: "#9CA3AF" }}>
                  {formatDate(user.createdAt)}
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <Link
                    href={`/admin/customers/${user.id}`}
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
                    Voir →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
