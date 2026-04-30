"use client";

import { useState, useEffect } from "react";

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface Props {
  minDelayDays?: number;
  blackoutDates?: string[];
  blockedDaysOfWeek?: number[];
  value?: string;
  onChange: (date: string) => void;
}

export function DeliveryDatePicker({
  minDelayDays = 1,
  blackoutDates = [],
  blockedDaysOfWeek = [0],
  value,
  onChange,
}: Props) {
  const [availableDates, setAvailableDates] = useState<Date[]>([]);

  useEffect(() => {
    const today = new Date();
    const dates: Date[] = [];
    let current = addDays(today, minDelayDays);

    while (dates.length < 14) {
      const dayOfWeek = current.getDay();
      const iso = formatDate(current);
      const isBlocked = blockedDaysOfWeek.includes(dayOfWeek) || blackoutDates.includes(iso);
      if (!isBlocked) {
        dates.push(new Date(current));
      }
      current = addDays(current, 1);
    }

    setAvailableDates(dates);
  }, [minDelayDays, blackoutDates.join(","), blockedDaysOfWeek.join(",")]);

  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--grey-600)", marginBottom: 10, display: "block" }}>
        Date de livraison souhaitée
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {availableDates.map((date) => {
          const iso = formatDate(date);
          const isSelected = value === iso;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onChange(iso)}
              style={{
                padding: "10px 14px",
                border: `1.5px solid ${isSelected ? "var(--red)" : "var(--grey-200)"}`,
                background: isSelected ? "#FEF2F2" : "var(--white)",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "var(--font-archivo), monospace",
                textAlign: "center",
                minWidth: 60,
              }}
            >
              <div style={{ fontWeight: 700, color: isSelected ? "var(--red)" : "var(--ink)" }}>{DAY_LABELS[date.getDay()]}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{date.getDate()}</div>
              <div style={{ fontSize: 10, color: "var(--grey-600)" }}>{MONTH_LABELS[date.getMonth()]}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
