"use client";

interface TimeSlot {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  extraPriceCents: number;
  maxCapacity: number;
}

interface Props {
  slots: TimeSlot[];
  selectedDate?: string;
  value?: string;
  onChange: (slotId: string) => void;
}

export function DeliveryTimeSlotPicker({ slots, selectedDate, value, onChange }: Props) {
  if (!selectedDate || slots.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--grey-600)", marginBottom: 10, display: "block" }}>
        Créneau horaire
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
        {slots.map((slot) => {
          const isSelected = value === slot.id;
          const priceLabel = slot.extraPriceCents > 0 ? ` (+${(slot.extraPriceCents / 100).toFixed(2)} €)` : "";
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => onChange(slot.id)}
              style={{
                padding: "10px 14px",
                border: `1.5px solid ${isSelected ? "var(--red)" : "var(--grey-200)"}`,
                background: isSelected ? "#FEF2F2" : "var(--white)",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "var(--font-archivo), monospace",
                textAlign: "left",
              }}
            >
              <div style={{ fontWeight: 700, color: isSelected ? "var(--red)" : "var(--ink)" }}>
                {slot.startTime} – {slot.endTime}
              </div>
              <div style={{ fontSize: 11, color: "var(--grey-600)", marginTop: 2 }}>
                {slot.label}{priceLabel}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
