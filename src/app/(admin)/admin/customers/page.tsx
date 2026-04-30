import Link from "next/link";
import { db } from "@/db";
import { users, orders } from "@/db/schema";
import { desc, count, ne } from "drizzle-orm";
import {
  AdminTopbar,
  AdminPage,
  AdminTableWrapper,
  AdminTableHead,
  AdminEmptyState,
  StatusBadge,
  T,
} from "@/components/admin/admin-ui";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function initials(name: string | null, email: string | null) {
  const src = name ?? email ?? "?";
  return src
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_COLORS: string[] = [
  "#EDE9FE", "#D1FAE5", "#DBEAFE", "#FCE7F3", "#FEF3C7",
];

function avatarColor(id: string): string {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  const idx = n % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx] !== undefined ? AVATAR_COLORS[idx] : "#EDE9FE";
}
function avatarTextColor(bg: string) {
  const map: Record<string, string> = {
    "#EDE9FE": "#5B21B6", "#D1FAE5": "#065F46",
    "#DBEAFE": "#1E40AF", "#FCE7F3": "#9D174D", "#FEF3C7": "#92400E",
  };
  return map[bg] ?? "#202223";
}

export default async function AdminCustomersPage() {
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(200);

  const orderCounts = await db
    .select({ userId: orders.userId, count: count() })
    .from(orders)
    .where(ne(orders.status, "draft"))
    .groupBy(orders.userId);

  const countMap = new Map(orderCounts.map((r) => [r.userId, Number(r.count)]));

  return (
    <>
      <AdminTopbar
        title="Clients"
        subtitle={`${rows.length} compte${rows.length > 1 ? "s" : ""}`}
      />

      <AdminPage>
        <AdminTableWrapper>
          {rows.length === 0 ? (
            <AdminEmptyState icon="👥" title="Aucun client" subtitle="Les comptes enregistrés apparaîtront ici." />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <AdminTableHead cols={["Client", "Email", "Rôle", "Commandes", "Inscrit le", ""]} />
              <tbody>
                {rows.map((user, i) => {
                  const bg = avatarColor(user.id ?? "");
                  const tc = avatarTextColor(bg);
                  const orders = countMap.get(user.id) ?? 0;
                  return (
                    <tr
                      key={user.id}
                      style={{ borderBottom: i < rows.length - 1 ? `1px solid ${T.borderSubtle}` : "none" }}
                      className="admin-table-row"
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: "50%",
                              background: bg,
                              color: tc,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 12,
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {initials(user.name, user.email)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: T.textPrimary }}>
                              {user.name ?? <span style={{ color: T.textDisabled, fontStyle: "italic" }}>Sans nom</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: T.textSecondary }}>{user.email}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <StatusBadge
                          label={user.role ?? "user"}
                          variant={user.role === "admin" ? "danger" : "neutral"}
                          dot={false}
                        />
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              background: orders > 0 ? T.brandLight : T.borderSubtle,
                              color: orders > 0 ? T.brand : T.textDisabled,
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                          >
                            {orders}
                          </span>
                          <span style={{ fontSize: 12, color: T.textSecondary }}>
                            commande{orders !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSecondary }}>
                        {formatDate(user.createdAt)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <Link
                          href={`/admin/customers/${user.id}`}
                          style={{
                            padding: "6px 12px",
                            borderRadius: T.radiusSm,
                            border: `1.5px solid ${T.border}`,
                            fontSize: 12,
                            fontWeight: 600,
                            color: T.textPrimary,
                            textDecoration: "none",
                          }}
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
        </AdminTableWrapper>
      </AdminPage>
    </>
  );
}
