"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AdminTopbar, AdminPage, AdminCard, T,
  PrimaryBtn, SecondaryBtn, SectionTitle,
} from "@/components/admin/admin-ui";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserData {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: "customer" | "admin";
  tags: string[];
  notes: string | null;
  emailVerified: boolean;
  createdAt: Date | string;
}

interface ProfileData {
  isProfessional: boolean;
  companyName: string | null;
  vatNumber: string | null;
  siret: string | null;
}

interface AddressData {
  id: string;
  label: string | null;
  firstName: string | null;
  lastName: string | null;
  line1: string;
  line2: string | null;
  postalCode: string;
  city: string;
  countryCode: string;
  phone: string | null;
  isDefault: boolean;
}

interface OrderData {
  id: string;
  status: string;
  totalCents: number;
  createdAt: Date | string;
}

interface Props {
  user: UserData;
  profile: ProfileData | null;
  addresses: AddressData[];
  orders: OrderData[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SUGGESTED_TAGS = ["VIP", "B2B", "Grossiste", "Revendeur", "Premium", "Fidèle", "Suspect", "Bloqué"];

const STATUS_LABELS: Record<string, string> = {
  proof_pending: "BAT en attente", proof_sent: "BAT envoyé",
  proof_revision_requested: "Révision", approved: "Approuvé",
  paid: "Payé", in_production: "Production", shipped: "Expédié",
  delivered: "Livré", cancelled: "Annulé", draft: "Brouillon",
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

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(date));
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CustomerDetailClient({ user: initialUser, profile: initialProfile, addresses, orders }: Props) {
  const [user, setUser] = useState(initialUser);
  const [profile, setProfile] = useState<ProfileData>(initialProfile ?? {
    isProfessional: false, companyName: null, vatNumber: null, siret: null,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");

  const totalSpent = orders
    .filter((o) => o.status !== "draft" && o.status !== "cancelled")
    .reduce((sum, o) => sum + o.totalCents, 0);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/customers/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          tags: user.tags,
          notes: user.notes,
          profile,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(String(data.error ?? "Erreur lors de la sauvegarde"));
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  function addTag(tag: string) {
    const t = tag.trim();
    if (t && !user.tags.includes(t)) {
      setUser((u) => ({ ...u, tags: [...u.tags, t] }));
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setUser((u) => ({ ...u, tags: u.tags.filter((t) => t !== tag) }));
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px",
    border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm,
    fontSize: 13, background: "#fff", boxSizing: "border-box", outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
    textTransform: "uppercase", color: T.textSecondary,
    display: "block", marginBottom: 6,
  };

  return (
    <>
      <AdminTopbar
        title={user.name ?? "Client sans nom"}
        subtitle={user.email}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {saved && <span style={{ fontSize: 13, color: "#059669", fontWeight: 600 }}>✓ Sauvegardé</span>}
          <Link href="/admin/customers"><SecondaryBtn>← Clients</SecondaryBtn></Link>
          <PrimaryBtn onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Sauvegarde…" : "Enregistrer"}
          </PrimaryBtn>
        </div>
      </AdminTopbar>

      <AdminPage>
        {error && (
          <div style={{ padding: "12px 16px", background: "#FEE2E2", border: `1px solid #FECACA`, borderRadius: T.radiusSm, fontSize: 13, color: "#B91C1C", marginBottom: 20 }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>

          {/* ── Left column ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Informations de base */}
            <AdminCard>
              <SectionTitle>Informations personnelles</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Nom complet</label>
                  <input
                    style={fieldStyle}
                    value={user.name ?? ""}
                    onChange={(e) => setUser((u) => ({ ...u, name: e.target.value }))}
                    placeholder="Prénom Nom"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Adresse email</label>
                  <input
                    style={fieldStyle}
                    type="email"
                    value={user.email}
                    onChange={(e) => setUser((u) => ({ ...u, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Téléphone</label>
                  <input
                    style={fieldStyle}
                    type="tel"
                    value={user.phone ?? ""}
                    onChange={(e) => setUser((u) => ({ ...u, phone: e.target.value || null }))}
                    placeholder="+33 6 00 00 00 00"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Rôle</label>
                  <select
                    style={fieldStyle}
                    value={user.role}
                    onChange={(e) => setUser((u) => ({ ...u, role: e.target.value as "customer" | "admin" }))}
                  >
                    <option value="customer">Client</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.textSecondary }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: user.emailVerified ? "#059669" : "#D97706", display: "inline-block" }} />
                  Email {user.emailVerified ? "vérifié" : "non vérifié"}
                </div>
                <div style={{ fontSize: 13, color: T.textSecondary }}>
                  Inscrit le {formatDate(user.createdAt)}
                </div>
              </div>
            </AdminCard>

            {/* Tags */}
            <AdminCard>
              <SectionTitle>Tags client</SectionTitle>
              <p style={{ fontSize: 13, color: T.textSecondary, marginBottom: 12 }}>
                Les tags sont utilisés dans les règles d&apos;expédition et les conditions de remise (ex&nbsp;: VIP, B2B, Revendeur…).
              </p>

              {/* Current tags */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {user.tags.length === 0 && (
                  <span style={{ fontSize: 13, color: T.textSecondary }}>Aucun tag</span>
                )}
                {user.tags.map((tag) => (
                  <span key={tag} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    background: "#e8f0fe", color: "#1a56db",
                    borderRadius: 4, padding: "4px 10px", fontSize: 13, fontWeight: 600,
                  }}>
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      style={{ border: "none", background: "none", cursor: "pointer", padding: 0, color: "#1a56db", fontSize: 16, lineHeight: 1 }}
                    >×</button>
                  </span>
                ))}
              </div>

              {/* Suggested tags */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {SUGGESTED_TAGS.filter((t) => !user.tags.includes(t)).map((t) => (
                  <button
                    key={t}
                    onClick={() => addTag(t)}
                    style={{
                      padding: "3px 10px", fontSize: 12, border: `1.5px dashed ${T.border}`,
                      borderRadius: 4, background: "transparent", cursor: "pointer", color: T.textSecondary,
                    }}
                  >+ {t}</button>
                ))}
              </div>

              {/* Custom tag input */}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }}
                  placeholder="Ajouter un tag personnalisé…"
                  style={{ ...fieldStyle, flex: 1 }}
                />
                <SecondaryBtn onClick={() => addTag(tagInput)}>Ajouter</SecondaryBtn>
              </div>
            </AdminCard>

            {/* Profil professionnel */}
            <AdminCard>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <SectionTitle>Profil professionnel</SectionTitle>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={profile.isProfessional}
                    onChange={(e) => setProfile((p) => ({ ...p, isProfessional: e.target.checked }))}
                  />
                  Client professionnel (B2B)
                </label>
              </div>
              {profile.isProfessional && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Nom de l&apos;entreprise</label>
                    <input
                      style={fieldStyle}
                      value={profile.companyName ?? ""}
                      onChange={(e) => setProfile((p) => ({ ...p, companyName: e.target.value || null }))}
                      placeholder="ACME SAS"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>N° TVA intracommunautaire</label>
                    <input
                      style={fieldStyle}
                      value={profile.vatNumber ?? ""}
                      onChange={(e) => setProfile((p) => ({ ...p, vatNumber: e.target.value || null }))}
                      placeholder="FR12345678901"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>SIRET</label>
                    <input
                      style={fieldStyle}
                      value={profile.siret ?? ""}
                      onChange={(e) => setProfile((p) => ({ ...p, siret: e.target.value || null }))}
                      placeholder="12345678900012"
                    />
                  </div>
                </div>
              )}
              {!profile.isProfessional && (
                <p style={{ fontSize: 13, color: T.textSecondary }}>Client particulier — cochez pour activer le mode professionnel.</p>
              )}
            </AdminCard>

            {/* Notes internes */}
            <AdminCard>
              <SectionTitle>Notes internes</SectionTitle>
              <p style={{ fontSize: 13, color: T.textSecondary, marginBottom: 8 }}>
                Visibles uniquement par les administrateurs.
              </p>
              <textarea
                value={user.notes ?? ""}
                onChange={(e) => setUser((u) => ({ ...u, notes: e.target.value || null }))}
                rows={4}
                placeholder="Notes sur ce client (comportement, préférences, incidents…)"
                style={{ ...fieldStyle, resize: "vertical", fontFamily: "inherit" }}
              />
            </AdminCard>
          </div>

          {/* ── Right column ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* KPIs */}
            <AdminCard>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "#F8FAFC", borderRadius: T.radiusSm, padding: "14px 16px" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: T.textPrimary, fontFamily: "monospace" }}>
                    {euros(totalSpent)}
                  </div>
                  <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>Total dépensé</div>
                </div>
                <div style={{ background: "#F8FAFC", borderRadius: T.radiusSm, padding: "14px 16px" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: T.textPrimary }}>
                    {orders.filter((o) => o.status !== "draft" && o.status !== "cancelled").length}
                  </div>
                  <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>Commandes</div>
                </div>
              </div>
            </AdminCard>

            {/* Adresses */}
            <AdminCard>
              <SectionTitle>Adresses ({addresses.length})</SectionTitle>
              {addresses.length === 0 && (
                <p style={{ fontSize: 13, color: T.textSecondary }}>Aucune adresse enregistrée.</p>
              )}
              {addresses.map((addr) => (
                <div key={addr.id} style={{
                  padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
                  marginBottom: 8, fontSize: 13,
                }}>
                  {addr.label && (
                    <div style={{ fontWeight: 700, marginBottom: 2, color: T.textPrimary }}>
                      {addr.label} {addr.isDefault && <span style={{ fontSize: 11, background: "#e8f0fe", color: "#1a56db", borderRadius: 3, padding: "1px 5px" }}>défaut</span>}
                    </div>
                  )}
                  <div>{addr.firstName} {addr.lastName}</div>
                  <div style={{ color: T.textSecondary }}>{addr.line1}</div>
                  {addr.line2 && <div style={{ color: T.textSecondary }}>{addr.line2}</div>}
                  <div style={{ color: T.textSecondary }}>{addr.postalCode} {addr.city} — {addr.countryCode}</div>
                  {addr.phone && <div style={{ color: T.textSecondary }}>{addr.phone}</div>}
                </div>
              ))}
            </AdminCard>

            {/* Commandes récentes */}
            <AdminCard>
              <SectionTitle>Commandes récentes</SectionTitle>
              {orders.length === 0 && (
                <p style={{ fontSize: 13, color: T.textSecondary }}>Aucune commande.</p>
              )}
              {orders.slice(0, 10).map((order) => {
                const sc = STATUS_COLORS[order.status] ?? { bg: "#F3F4F6", text: "#6B7280" };
                return (
                  <div key={order.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13,
                  }}>
                    <div>
                      <div style={{ fontFamily: "monospace", fontSize: 12, color: T.textSecondary }}>
                        #{order.id.slice(0, 8).toUpperCase()}
                      </div>
                      <div style={{ fontSize: 11, color: T.textSecondary }}>{formatDate(order.createdAt)}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.text }}>
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                      <span style={{ fontWeight: 700, fontFamily: "monospace", fontSize: 13 }}>{euros(order.totalCents)}</span>
                      <Link href={`/admin/orders/${order.id}`} style={{ fontSize: 11, color: T.textSecondary, textDecoration: "underline" }}>→</Link>
                    </div>
                  </div>
                );
              })}
              {orders.length > 10 && (
                <p style={{ fontSize: 12, color: T.textSecondary, marginTop: 8 }}>+{orders.length - 10} commandes supplémentaires</p>
              )}
            </AdminCard>

          </div>
        </div>
      </AdminPage>
    </>
  );
}
