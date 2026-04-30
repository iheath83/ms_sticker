"use client";

import { useState, useEffect, useRef } from "react";
import { T } from "@/components/admin/admin-ui";

interface Commune {
  nom: string;
  codesPostaux: string[];
  departement?: { nom: string };
}

interface Props {
  /** Codes postaux déjà saisis (texte brut, une règle par ligne) */
  value: string;
  onChange: (v: string) => void;
  /** Codes pays sélectionnés pour adapter l'API */
  countries?: string[];
}

export function PostalCodeSearch({ value, onChange, countries = [] }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Commune[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFranceOnly = countries.length === 0 || (countries.length === 1 && countries[0] === "FR") || countries.every((c) => ["FR", "GP", "MQ", "GF", "RE", "YT", "PM"].includes(c));

  useEffect(() => {
    if (!query || query.length < 2 || !isFranceOnly) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const isNumeric = /^\d+$/.test(query);
        const url = isNumeric
          ? `https://geo.api.gouv.fr/communes?codePostal=${query}&fields=nom,codesPostaux,departement&limit=8`
          : `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(query)}&fields=nom,codesPostaux,departement&boost=population&limit=8`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json() as Commune[];
          setSuggestions(data);
        }
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, isFranceOnly]);

  function addCode(code: string) {
    const lines = value.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.includes(code)) {
      onChange([...lines, code].join("\n"));
    }
    setQuery("");
    setSuggestions([]);
  }

  function addPrefix(prefix: string) {
    const rule = `${prefix}*`;
    const lines = value.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.includes(rule)) {
      onChange([...lines, rule].join("\n"));
    }
    setQuery("");
    setSuggestions([]);
  }

  return (
    <div>
      {isFranceOnly && (
        <div style={{ marginBottom: 8, position: "relative" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher une commune ou un code postal (France)…"
                style={{
                  width: "100%", padding: "9px 12px",
                  border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm,
                  fontSize: 13, boxSizing: "border-box", outline: "none",
                }}
              />
              {loading && (
                <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: T.textSecondary }}>
                  Recherche…
                </div>
              )}
            </div>
          </div>

          {suggestions.length > 0 && (
            <div style={{
              position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, zIndex: 50,
              background: "#fff", border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm,
              boxShadow: "0 4px 16px rgba(0,0,0,0.1)", maxHeight: 280, overflowY: "auto",
            }}>
              {suggestions.map((c, i) => (
                <div key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ padding: "8px 14px 4px", fontSize: 12, color: T.textSecondary, fontWeight: 600 }}>
                    {c.nom} {c.departement ? `— ${c.departement.nom}` : ""}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "4px 14px 8px" }}>
                    {c.codesPostaux.map((cp) => (
                      <button
                        key={cp}
                        onClick={() => addCode(cp)}
                        style={{
                          padding: "3px 8px", fontSize: 12, border: `1px solid ${T.border}`,
                          borderRadius: 4, background: "#f8fafc", cursor: "pointer",
                          fontFamily: "monospace", fontWeight: 600,
                        }}
                        title={`Ajouter ${cp} (exact)`}
                      >{cp}</button>
                    ))}
                    {/* Bouton préfixe département */}
                    {c.codesPostaux.length > 0 && c.codesPostaux[0] && (
                      <button
                        onClick={() => addPrefix(c.codesPostaux[0]!.slice(0, 2))}
                        style={{
                          padding: "3px 8px", fontSize: 12, border: `1px solid ${T.brand}`,
                          borderRadius: 4, background: "#e8f0fe", cursor: "pointer", color: T.brand,
                          fontFamily: "monospace", fontWeight: 600,
                        }}
                        title={`Ajouter tout le département ${c.codesPostaux[0]!.slice(0, 2)}*`}
                      >{c.codesPostaux[0]!.slice(0, 2)}* (dépt.)</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Zone de texte principale */}
      <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 6 }}>
        {isFranceOnly
          ? "Cliquez sur un code pour l'ajouter, ou saisissez manuellement ci-dessous."
          : "Saisissez les règles manuellement (API disponible uniquement pour la France)."
        }
        <br />
        Formats : <code>75001</code> exact · <code>75*</code> préfixe · <code>75000-75999</code> plage · <code>!201*</code> exclusion
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        placeholder={"75*\n69001\n13000-13016\n!20*"}
        style={{
          width: "100%", padding: "9px 12px",
          border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm,
          fontSize: 13, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box",
        }}
      />
    </div>
  );
}
