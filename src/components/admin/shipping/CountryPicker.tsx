"use client";

import { useState, useRef, useEffect } from "react";
import { T } from "@/components/admin/admin-ui";

export const COUNTRIES: { code: string; name: string; flag: string }[] = [
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "BE", name: "Belgique", flag: "🇧🇪" },
  { code: "CH", name: "Suisse", flag: "🇨🇭" },
  { code: "LU", name: "Luxembourg", flag: "🇱🇺" },
  { code: "MC", name: "Monaco", flag: "🇲🇨" },
  { code: "DE", name: "Allemagne", flag: "🇩🇪" },
  { code: "ES", name: "Espagne", flag: "🇪🇸" },
  { code: "IT", name: "Italie", flag: "🇮🇹" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "NL", name: "Pays-Bas", flag: "🇳🇱" },
  { code: "GB", name: "Royaume-Uni", flag: "🇬🇧" },
  { code: "IE", name: "Irlande", flag: "🇮🇪" },
  { code: "DK", name: "Danemark", flag: "🇩🇰" },
  { code: "SE", name: "Suède", flag: "🇸🇪" },
  { code: "NO", name: "Norvège", flag: "🇳🇴" },
  { code: "FI", name: "Finlande", flag: "🇫🇮" },
  { code: "AT", name: "Autriche", flag: "🇦🇹" },
  { code: "PL", name: "Pologne", flag: "🇵🇱" },
  { code: "CZ", name: "République tchèque", flag: "🇨🇿" },
  { code: "SK", name: "Slovaquie", flag: "🇸🇰" },
  { code: "HU", name: "Hongrie", flag: "🇭🇺" },
  { code: "RO", name: "Roumanie", flag: "🇷🇴" },
  { code: "BG", name: "Bulgarie", flag: "🇧🇬" },
  { code: "HR", name: "Croatie", flag: "🇭🇷" },
  { code: "SI", name: "Slovénie", flag: "🇸🇮" },
  { code: "GR", name: "Grèce", flag: "🇬🇷" },
  { code: "CY", name: "Chypre", flag: "🇨🇾" },
  { code: "MT", name: "Malte", flag: "🇲🇹" },
  { code: "EE", name: "Estonie", flag: "🇪🇪" },
  { code: "LV", name: "Lettonie", flag: "🇱🇻" },
  { code: "LT", name: "Lituanie", flag: "🇱🇹" },
  { code: "US", name: "États-Unis", flag: "🇺🇸" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "AU", name: "Australie", flag: "🇦🇺" },
  { code: "JP", name: "Japon", flag: "🇯🇵" },
  { code: "CN", name: "Chine", flag: "🇨🇳" },
  { code: "IN", name: "Inde", flag: "🇮🇳" },
  { code: "BR", name: "Brésil", flag: "🇧🇷" },
  { code: "MX", name: "Mexique", flag: "🇲🇽" },
  { code: "AR", name: "Argentine", flag: "🇦🇷" },
  { code: "ZA", name: "Afrique du Sud", flag: "🇿🇦" },
  { code: "MA", name: "Maroc", flag: "🇲🇦" },
  { code: "TN", name: "Tunisie", flag: "🇹🇳" },
  { code: "DZ", name: "Algérie", flag: "🇩🇿" },
  { code: "SN", name: "Sénégal", flag: "🇸🇳" },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮" },
  { code: "CM", name: "Cameroun", flag: "🇨🇲" },
  { code: "KR", name: "Corée du Sud", flag: "🇰🇷" },
  { code: "SG", name: "Singapour", flag: "🇸🇬" },
  { code: "AE", name: "Émirats arabes unis", flag: "🇦🇪" },
  { code: "GP", name: "Guadeloupe", flag: "🇬🇵" },
  { code: "MQ", name: "Martinique", flag: "🇲🇶" },
  { code: "GF", name: "Guyane française", flag: "🇬🇫" },
  { code: "RE", name: "La Réunion", flag: "🇷🇪" },
  { code: "YT", name: "Mayotte", flag: "🇾🇹" },
  { code: "PM", name: "Saint-Pierre-et-Miquelon", flag: "🇵🇲" },
  { code: "NC", name: "Nouvelle-Calédonie", flag: "🇳🇨" },
  { code: "PF", name: "Polynésie française", flag: "🇵🇫" },
  { code: "WF", name: "Wallis-et-Futuna", flag: "🇼🇫" },
];

interface Props {
  selected: string[]; // ISO codes
  onChange: (codes: string[]) => void;
}

export function CountryPicker({ selected, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = COUNTRIES.filter((c) => {
    const q = query.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
  });

  function toggle(code: string) {
    if (selected.includes(code)) {
      onChange(selected.filter((c) => c !== code));
    } else {
      onChange([...selected, code]);
    }
  }

  const selectedCountries = COUNTRIES.filter((c) => selected.includes(c.code));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Tags */}
      <div
        onClick={() => setOpen(true)}
        style={{
          minHeight: 40,
          padding: "4px 10px",
          border: `1.5px solid ${open ? T.brand : T.border}`,
          borderRadius: T.radiusSm,
          background: "#fff",
          cursor: "text",
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          alignItems: "center",
        }}
      >
        {selectedCountries.map((c) => (
          <span
            key={c.code}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              background: "#e8f0fe", color: "#1a56db",
              borderRadius: 4, padding: "2px 6px", fontSize: 12, fontWeight: 600,
            }}
          >
            {c.flag} {c.code}
            <button
              onClick={(e) => { e.stopPropagation(); toggle(c.code); }}
              style={{ border: "none", background: "none", cursor: "pointer", padding: 0, lineHeight: 1, color: "#1a56db", fontSize: 14 }}
            >×</button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? "Rechercher un pays…" : ""}
          style={{ border: "none", outline: "none", fontSize: 13, flex: 1, minWidth: 120, background: "transparent" }}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100,
          background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)", maxHeight: 220, overflowY: "auto",
        }}>
          {filtered.length === 0 && (
            <div style={{ padding: "10px 14px", fontSize: 13, color: T.textSecondary }}>Aucun pays trouvé</div>
          )}
          {filtered.map((c) => (
            <div
              key={c.code}
              onClick={() => { toggle(c.code); setQuery(""); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 14px", cursor: "pointer", fontSize: 13,
                background: selected.includes(c.code) ? "#f0f5ff" : "transparent",
                fontWeight: selected.includes(c.code) ? 600 : 400,
              }}
            >
              <span style={{ fontSize: 18 }}>{c.flag}</span>
              <span style={{ flex: 1 }}>{c.name}</span>
              <span style={{ color: T.textSecondary, fontSize: 11 }}>{c.code}</span>
              {selected.includes(c.code) && <span style={{ color: T.brand }}>✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
