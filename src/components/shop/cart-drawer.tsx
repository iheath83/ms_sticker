"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { CloseIcon, TrashIcon, ArrowIcon } from "./icons";
import { useCart } from "./cart-context";
import type { CartItemFile } from "@/lib/cart-types";

const qtyBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  width: 28,
  height: 28,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
};

// ─── File zone per cart item ──────────────────────────────────────────────────

function CartItemFileZone({
  itemId,
  orderId,
  file,
  onRefresh,
}: {
  itemId: string;
  orderId: string;
  file: CartItemFile | null;
  onRefresh: () => Promise<void>;
}) {
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const isImage = file?.mimeType?.startsWith("image/");

  async function uploadFile(f: File) {
    setStatus("uploading");
    try {
      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, type: "customer_upload", filename: f.name, mimeType: f.type || "application/octet-stream" }),
      });
      if (!presignRes.ok) { setStatus("error"); return; }

      const { uploadUrl, key } = await presignRes.json() as { uploadUrl: string; key: string };
      const putRes = await fetch(uploadUrl, { method: "PUT", body: f, headers: { "Content-Type": f.type || "application/octet-stream" } });
      if (!putRes.ok) { setStatus("error"); return; }

      const confirmRes = await fetch("/api/uploads/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, itemId, key, filename: f.name, mimeType: f.type, replace: true }),
      });
      if (!confirmRes.ok) { setStatus("error"); return; }

      setStatus("done");
      await onRefresh();
    } catch {
      setStatus("error");
    }
  }

  if (file) {
    return (
      <div
        style={{
          marginTop: 10,
          padding: "8px 10px",
          background: "#F0FDF4",
          border: "1px solid #86EFAC",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {/* Thumbnail or icon */}
        {isImage ? (
          <FileThumb fileKey={file.key} orderId={orderId} />
        ) : (
          <div style={{ width: 32, height: 32, background: "#DBEAFE", borderRadius: 6, display: "grid", placeItems: "center", fontSize: 16, flexShrink: 0 }}>
            📄
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#14532D", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {file.filename ?? "Fichier design"}
          </div>
          <div style={{ fontSize: 10, color: "#6B7280" }}>{file.mimeType ?? ""}</div>
        </div>

        <button
          onClick={() => inputRef.current?.click()}
          disabled={status === "uploading"}
          style={{
            padding: "4px 8px",
            fontSize: 10,
            fontWeight: 700,
            background: "transparent",
            border: "1px solid #16A34A",
            borderRadius: 6,
            color: "#16A34A",
            cursor: "pointer",
            flexShrink: 0,
            fontFamily: "var(--font-archivo), monospace",
            whiteSpace: "nowrap",
          }}
        >
          {status === "uploading" ? "…" : "Remplacer"}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.pdf,.ai,.svg"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f); }}
        />
      </div>
    );
  }

  // No file yet
  return (
    <div style={{ marginTop: 10 }}>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          background: "var(--grey-50)",
          border: `1px dashed ${status === "error" ? "var(--red)" : "var(--grey-200)"}`,
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 11,
          color: "var(--grey-600)",
          fontFamily: "var(--font-archivo), monospace",
        }}
      >
        <span style={{ fontSize: 14 }}>{status === "uploading" ? "⏳" : status === "done" ? "✅" : "⬆️"}</span>
        <span style={{ fontWeight: 600 }}>
          {status === "uploading" ? "Envoi en cours…" : status === "error" ? "Erreur — réessayer" : "Ajouter mon design"}
        </span>
        <input
          type="file"
          accept=".png,.jpg,.jpeg,.pdf,.ai,.svg"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f); }}
        />
      </label>
    </div>
  );
}

function FileThumb({ fileKey, orderId }: { fileKey: string; orderId: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/uploads/download?key=${encodeURIComponent(fileKey)}&orderId=${encodeURIComponent(orderId)}`)
      .then((r) => r.json() as Promise<{ url?: string }>)
      .then((d) => { if (d.url) setSrc(d.url); })
      .catch(() => null);
  }, [fileKey, orderId]);

  if (!src) {
    return <div style={{ width: 32, height: 32, background: "#D1FAE5", borderRadius: 6, display: "grid", placeItems: "center", fontSize: 14, flexShrink: 0 }}>🖼️</div>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="design"
      style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 6, flexShrink: 0, border: "1px solid #86EFAC" }}
    />
  );
}

export function CartDrawer() {
  const { cart, cartOpen, setCartOpen, updateQty, removeItem, isPending, refreshCart } = useCart();
  const totalEuros = cart.totalCents / 100;
  const subtotalEuros = cart.subtotalCents / 100;
  const shipping = subtotalEuros >= 50 ? 0 : 4.9;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={() => setCartOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(10,14,39,0.5)",
          zIndex: 100,
          opacity: cartOpen ? 1 : 0,
          pointerEvents: cartOpen ? "auto" : "none",
          transition: "opacity 0.2s",
        }}
      />

      {/* Drawer */}
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 440,
          background: "var(--cream)",
          zIndex: 101,
          display: "flex",
          flexDirection: "column",
          transform: cartOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          borderLeft: "2px solid var(--ink)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "2px solid var(--ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--white)",
          }}
        >
          <div>
            <div
              style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--red)", fontWeight: 700 }}
            >
              ◆ VOTRE COMMANDE
            </div>
            <h3
              style={{
                fontSize: 22,
                marginTop: 4,
                fontFamily: "var(--font-archivo), system-ui, sans-serif",
                fontWeight: 800,
              }}
            >
              Panier ({cart.itemCount})
            </h3>
          </div>
          <button
            onClick={() => setCartOpen(false)}
            style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer" }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20, opacity: isPending ? 0.7 : 1, transition: "opacity 0.2s" }}>
          {cart.items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 60, marginBottom: 16 }}>🛒</div>
              <p style={{ fontSize: 14, color: "var(--grey-600)" }}>Votre panier est vide.</p>
              <Link
                href="/custom-stickers"
                onClick={() => setCartOpen(false)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  marginTop: 20,
                  padding: "14px 24px",
                  background: "var(--red)",
                  color: "var(--white)",
                  border: "2px solid var(--ink)",
                  borderRadius: "var(--r)",
                  fontFamily: "var(--font-archivo), monospace",
                  fontWeight: 600,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                Configurer un sticker
              </Link>
            </div>
          ) : (
            cart.items.map((item) => (
              <div
                key={item.id}
                style={{
                  background: "var(--white)",
                  border: "1.5px solid var(--ink)",
                  borderRadius: "var(--r)",
                  padding: 16,
                  marginBottom: 12,
                  display: "flex",
                  gap: 14,
                }}
              >
                {/* Shape indicator */}
                <div
                  style={{
                    width: 72,
                    height: 72,
                    background: "var(--grey-50)",
                    borderRadius: 8,
                    display: "grid",
                    placeItems: "center",
                    border: "1px dashed var(--grey-200)",
                    flexShrink: 0,
                    fontSize: 24,
                  }}
                >
                  {item.shape === "circle" ? "⬤" : item.shape === "die-cut" ? "⬟" : "■"}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{item.productName}</div>
                  <div style={{ fontSize: 11, color: "var(--grey-600)", marginTop: 2 }}>
                    {item.shape} · {item.widthMm}×{item.heightMm} mm · {item.material}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        border: "1px solid var(--ink)",
                        borderRadius: 6,
                      }}
                    >
                      <button
                        style={qtyBtnStyle}
                        onClick={() => updateQty(item.id, Math.max(1, item.quantity - 25))}
                        disabled={isPending}
                      >
                        −
                      </button>
                      <span style={{ padding: "0 10px", fontSize: 12, fontWeight: 600 }}>
                        {item.quantity}
                      </span>
                      <button
                        style={qtyBtnStyle}
                        onClick={() => updateQty(item.id, item.quantity + 25)}
                        disabled={isPending}
                      >
                        +
                      </button>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>
                      {(item.lineTotalCents / 100).toFixed(2)} €
                    </div>
                  </div>

                  {/* File zone */}
                  <CartItemFileZone
                    itemId={item.id}
                    orderId={cart.orderId}
                    file={item.file}
                    onRefresh={refreshCart}
                  />
                </div>

                <button
                  onClick={() => removeItem(item.id)}
                  disabled={isPending}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--grey-400)",
                    alignSelf: "flex-start",
                    padding: 4,
                    cursor: "pointer",
                  }}
                >
                  <TrashIcon />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.items.length > 0 && (
          <div
            style={{ borderTop: "2px solid var(--ink)", padding: 20, background: "var(--white)" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                marginBottom: 6,
                color: "var(--grey-600)",
              }}
            >
              <span>Sous-total HT</span>
              <span>{subtotalEuros.toFixed(2)} €</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                marginBottom: 6,
                color: "var(--grey-600)",
              }}
            >
              <span>Livraison</span>
              <span style={{ color: "var(--red)", fontWeight: 600 }}>
                {shipping === 0 ? "OFFERTE" : `${shipping.toFixed(2)} €`}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 18,
                fontWeight: 800,
                fontFamily: "var(--font-archivo), system-ui, sans-serif",
                marginBottom: 16,
                paddingTop: 12,
                borderTop: "1px dashed var(--grey-200)",
              }}
            >
              <span>Total TTC</span>
              <span>{(totalEuros + shipping).toFixed(2)} €</span>
            </div>
            <Link
              href="/checkout"
              onClick={() => setCartOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: "18px 28px",
                background: "var(--red)",
                color: "var(--white)",
                border: "2px solid var(--ink)",
                borderRadius: "var(--r)",
                fontFamily: "var(--font-archivo), monospace",
                fontWeight: 600,
                fontSize: 14,
                textDecoration: "none",
                width: "100%",
              }}
            >
              Passer commande <ArrowIcon />
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
