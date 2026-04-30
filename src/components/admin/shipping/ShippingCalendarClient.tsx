"use client";

import { useState } from "react";
import {
  AdminTopbar, AdminPage, AdminCard, AdminTableWrapper, AdminTableHead,
  AdminEmptyState, PrimaryBtn, SecondaryBtn, DangerBtn, T, SectionTitle,
} from "@/components/admin/admin-ui";
import type { ShippingBlackoutDate, ShippingTimeSlot } from "@/db/schema";

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export function ShippingCalendarClient({
  blackouts: initialBlackouts,
  slots: initialSlots,
}: {
  blackouts: ShippingBlackoutDate[];
  slots: ShippingTimeSlot[];
}) {
  const [blackouts, setBlackouts] = useState<ShippingBlackoutDate[]>(initialBlackouts);
  const [slots, setSlots] = useState<ShippingTimeSlot[]>(initialSlots);

  // Blackout form
  const [blackoutForm, setBlackoutForm] = useState({ date: "", reason: "", isRecurring: false });
  const [savingBlackout, setSavingBlackout] = useState(false);

  // Timeslot form
  const [slotForm, setSlotForm] = useState({ label: "", startTime: "09:00", endTime: "12:00", daysOfWeek: [1, 2, 3, 4, 5] as number[], maxCapacity: "0", extraPriceCents: "0", isActive: true });
  const [savingSlot, setSavingSlot] = useState(false);

  async function addBlackout() {
    if (!blackoutForm.date) return;
    setSavingBlackout(true);
    try {
      const res = await fetch("/api/admin/shipping/blackout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: blackoutForm.date,
          reason: blackoutForm.reason || null,
          isRecurring: blackoutForm.isRecurring,
          affectsMethodIds: [],
        }),
      });
      const data = await res.json() as { blackout?: ShippingBlackoutDate };
      if (data.blackout) {
        setBlackouts((prev) => [...prev, data.blackout!]);
        setBlackoutForm({ date: "", reason: "", isRecurring: false });
      }
    } finally {
      setSavingBlackout(false);
    }
  }

  async function deleteBlackout(id: string) {
    await fetch(`/api/admin/shipping/blackout/${id}`, { method: "DELETE" });
    setBlackouts((prev) => prev.filter((b) => b.id !== id));
  }

  async function addSlot() {
    if (!slotForm.label) return;
    setSavingSlot(true);
    try {
      const res = await fetch("/api/admin/shipping/timeslots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: slotForm.label,
          startTime: slotForm.startTime,
          endTime: slotForm.endTime,
          daysOfWeek: slotForm.daysOfWeek,
          maxCapacity: parseInt(slotForm.maxCapacity, 10) || 0,
          extraPriceCents: parseInt(slotForm.extraPriceCents, 10) || 0,
          isActive: slotForm.isActive,
        }),
      });
      const data = await res.json() as { slot?: ShippingTimeSlot };
      if (data.slot) {
        setSlots((prev) => [...prev, data.slot!]);
        setSlotForm({ label: "", startTime: "09:00", endTime: "12:00", daysOfWeek: [1, 2, 3, 4, 5], maxCapacity: "0", extraPriceCents: "0", isActive: true });
      }
    } finally {
      setSavingSlot(false);
    }
  }

  async function deleteSlot(id: string) {
    await fetch(`/api/admin/shipping/timeslots/${id}`, { method: "DELETE" });
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <>
      <AdminTopbar title="Dates & Créneaux" subtitle="Gérer les jours bloqués et créneaux horaires" />

      <AdminPage>
        {/* Blackout dates */}
        <SectionTitle>Jours bloqués</SectionTitle>
        <AdminCard style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={blackoutForm.date} onChange={(e) => setBlackoutForm((f) => ({ ...f, date: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={labelStyle}>Raison (optionnel)</label>
              <input value={blackoutForm.reason} onChange={(e) => setBlackoutForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Noël, Nouvel An…" style={inputStyle} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, paddingBottom: 4 }}>
              <input type="checkbox" checked={blackoutForm.isRecurring} onChange={(e) => setBlackoutForm((f) => ({ ...f, isRecurring: e.target.checked }))} />
              Récurrent chaque année
            </label>
            <PrimaryBtn onClick={() => void addBlackout()} disabled={savingBlackout || !blackoutForm.date}>
              {savingBlackout ? "…" : "Ajouter"}
            </PrimaryBtn>
          </div>

          <AdminTableWrapper>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <AdminTableHead cols={["Date", "Raison", "Récurrent", "Actions"]} />
              <tbody>
                {blackouts.length === 0 && (
                  <tr><td colSpan={4}><AdminEmptyState title="Aucun jour bloqué" subtitle="Ajoutez des jours fériés ou de fermeture" /></td></tr>
                )}
                {blackouts.sort((a, b) => a.date.localeCompare(b.date)).map((b) => (
                  <tr key={b.id} className="admin-table-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600 }}>{b.date}</td>
                    <td style={{ padding: "10px 16px", fontSize: 13 }}>{b.reason ?? "—"}</td>
                    <td style={{ padding: "10px 16px", fontSize: 12 }}>{b.isRecurring ? "Oui" : "Non"}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <DangerBtn onClick={() => void deleteBlackout(b.id)}>Supprimer</DangerBtn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableWrapper>
        </AdminCard>

        {/* Time slots */}
        <SectionTitle>Créneaux horaires</SectionTitle>
        <AdminCard>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Libellé</label>
                <input value={slotForm.label} onChange={(e) => setSlotForm((f) => ({ ...f, label: e.target.value }))} placeholder="Matin 9h-12h" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Début</label>
                <input type="time" value={slotForm.startTime} onChange={(e) => setSlotForm((f) => ({ ...f, startTime: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Fin</label>
                <input type="time" value={slotForm.endTime} onChange={(e) => setSlotForm((f) => ({ ...f, endTime: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Capacité max (0 = illimitée)</label>
                <input type="number" value={slotForm.maxCapacity} onChange={(e) => setSlotForm((f) => ({ ...f, maxCapacity: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <label style={{ ...labelStyle, marginBottom: 6 }}>Jours disponibles</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                    <label key={d} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={slotForm.daysOfWeek.includes(d)}
                        onChange={(e) => setSlotForm((f) => ({
                          ...f,
                          daysOfWeek: e.target.checked ? [...f.daysOfWeek, d] : f.daysOfWeek.filter((x) => x !== d),
                        }))}
                      />
                      {DAY_LABELS[d]}
                    </label>
                  ))}
                </div>
              </div>
              <PrimaryBtn onClick={() => void addSlot()} disabled={savingSlot || !slotForm.label}>
                {savingSlot ? "…" : "Ajouter le créneau"}
              </PrimaryBtn>
            </div>
          </div>

          <AdminTableWrapper>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <AdminTableHead cols={["Créneau", "Horaires", "Jours", "Capacité", "Actions"]} />
              <tbody>
                {slots.length === 0 && (
                  <tr><td colSpan={5}><AdminEmptyState title="Aucun créneau" subtitle="Ajoutez des créneaux de livraison" /></td></tr>
                )}
                {slots.map((s) => (
                  <tr key={s.id} className="admin-table-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600 }}>{s.label}</td>
                    <td style={{ padding: "10px 16px", fontSize: 12 }}>{s.startTime} – {s.endTime}</td>
                    <td style={{ padding: "10px 16px", fontSize: 12 }}>
                      {((s.daysOfWeek as number[]) ?? []).map((d) => DAY_LABELS[d]).join(", ")}
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 12 }}>{s.maxCapacity === 0 ? "Illimitée" : s.maxCapacity}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <DangerBtn onClick={() => void deleteSlot(s.id)}>Supprimer</DangerBtn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableWrapper>
        </AdminCard>
      </AdminPage>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
  textTransform: "uppercase", color: T.textSecondary, display: "block", marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px",
  border: `1.5px solid ${T.border}`,
  borderRadius: T.radiusSm, fontSize: 13,
  boxSizing: "border-box",
};
