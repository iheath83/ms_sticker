"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useCart } from "../cart-context";
import { TruckIcon, SparklesIcon, ShieldIcon, ArrowIcon, TrashIcon } from "../icons";
import { submitOrder, validateVatAction } from "@/lib/order-actions";
import { useSession } from "@/lib/auth-client";
import type { CartItemFile } from "@/lib/cart-actions";
import { getUserAddresses, saveAddress, type SavedAddress } from "@/lib/address-actions";

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY;
if (!stripeKey) throw new Error("NEXT_PUBLIC_STRIPE_PUBLIC_KEY is not set");
const stripePromise = loadStripe(stripeKey);

// ─── Sub-components ───────────────────────────────────────────────────────────

function InputField({
  label, value, onChange, error, placeholder, span = 1, type = "text", readOnly = false,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  error?: string | undefined; placeholder?: string | undefined; span?: 1 | 2; type?: string | undefined; readOnly?: boolean | undefined;
}) {
  return (
    <div style={{ gridColumn: span === 2 ? "1 / -1" : "auto" }}>
      <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--grey-600)", marginBottom: 8, display: "block" }}>
        {label}
      </label>
      <input
        type={type} value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={readOnly} placeholder={placeholder}
        style={{
          width: "100%", padding: "12px 14px",
          border: `1.5px solid ${error ? "var(--red)" : readOnly ? "var(--grey-100)" : "var(--grey-200)"}`,
          borderRadius: "var(--r)", fontFamily: "var(--font-mono), monospace", fontSize: 13,
          background: readOnly ? "var(--grey-50)" : "var(--white)", outline: "none",
          color: readOnly ? "var(--grey-600)" : "var(--ink)", cursor: readOnly ? "default" : "text",
        }}
      />
      {error && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>{error}</div>}
    </div>
  );
}

function FormCard({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--white)", border: "1.5px solid var(--grey-200)", borderRadius: "var(--r-lg)", padding: 28, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 11, color: "var(--red)", fontWeight: 700, letterSpacing: "0.15em" }}>◆ {num}</span>
        <h3 style={{ fontSize: 22, fontFamily: "var(--font-archivo), system-ui, sans-serif", fontWeight: 800 }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ─── Address selector ─────────────────────────────────────────────────────────

function AddressSelector({
  addresses,
  onSelect,
}: {
  addresses: SavedAddress[];
  onSelect: (addr: SavedAddress) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  function pick(addr: SavedAddress) {
    setSelected(addr.id);
    onSelect(addr);
    setOpen(false);
  }

  const current = addresses.find((a) => a.id === selected);
  const label = current
    ? `${current.label ? `${current.label} — ` : ""}${current.firstName ?? ""} ${current.lastName ?? ""}, ${current.line1}`
    : "Choisir une adresse enregistrée";

  return (
    <div style={{ marginBottom: 16, position: "relative" }}>
      <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--grey-600)", marginBottom: 8, display: "block" }}>
        Mes adresses enregistrées
      </label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", padding: "12px 14px",
          border: "1.5px solid var(--grey-200)", borderRadius: "var(--r)",
          background: "var(--white)", fontFamily: "var(--font-mono), monospace",
          fontSize: 13, textAlign: "left", cursor: "pointer", display: "flex",
          justifyContent: "space-between", alignItems: "center", color: current ? "var(--ink)" : "var(--grey-400)",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ fontSize: 10, flexShrink: 0, marginLeft: 8 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
          background: "var(--white)", border: "1.5px solid var(--grey-200)", borderRadius: "var(--r)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxHeight: 260, overflowY: "auto",
        }}>
          {addresses.map((addr) => (
            <button
              key={addr.id}
              type="button"
              onClick={() => pick(addr)}
              style={{
                width: "100%", padding: "12px 16px", border: "none", borderBottom: "1px solid var(--grey-100)",
                background: addr.id === selected ? "#FEF2F2" : "var(--white)", cursor: "pointer",
                textAlign: "left", fontFamily: "var(--font-mono), monospace",
                display: "flex", flexDirection: "column", gap: 2,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: addr.id === selected ? "var(--red)" : "var(--ink)" }}>
                  {addr.label ?? "Adresse"}
                  {addr.isDefault && <span style={{ marginLeft: 6, fontSize: 10, background: "#FEF2F2", color: "var(--red)", padding: "1px 5px", borderRadius: 4, border: "1px solid var(--red)" }}>Défaut</span>}
                </span>
                {addr.id === selected && <span style={{ color: "var(--red)", fontSize: 14 }}>✓</span>}
              </div>
              <span style={{ fontSize: 12, color: "var(--grey-600)" }}>
                {[addr.firstName, addr.lastName].filter(Boolean).join(" ")}{addr.firstName || addr.lastName ? " · " : ""}
                {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""} · {addr.postalCode} {addr.city}
              </span>
              {addr.phone && <span style={{ fontSize: 11, color: "var(--grey-400)" }}>{addr.phone}</span>}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setSelected(null); setOpen(false); }}
            style={{
              width: "100%", padding: "10px 16px", border: "none", background: "var(--grey-50)",
              cursor: "pointer", textAlign: "center", fontSize: 12, color: "var(--grey-600)",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            + Saisir une nouvelle adresse
          </button>
        </div>
      )}
    </div>
  );
}

function DeliveryOption({ active, onClick, icon, title, sub, price }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub: string; price: string;
}) {
  return (
    <button onClick={onClick} style={{
      padding: 16, border: `1.5px solid ${active ? "var(--red)" : "var(--grey-200)"}`,
      background: active ? "#FEF2F2" : "var(--white)", borderRadius: "var(--r)", cursor: "pointer",
      fontFamily: "var(--font-mono), monospace", display: "flex", alignItems: "center", gap: 14,
      textAlign: "left", width: "100%",
    }}>
      <div style={{ width: 36, height: 36, background: active ? "var(--red)" : "var(--grey-100)", color: active ? "var(--white)" : "var(--ink)", borderRadius: 8, display: "grid", placeItems: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--grey-600)" }}>{sub}</div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: price === "OFFERT" ? "var(--red)" : "var(--ink)", flexShrink: 0 }}>{price}</div>
    </button>
  );
}

// ─── Editable cart item (file zone) ──────────────────────────────────────────

function CartItemFileZoneCheckout({
  itemId, orderId, file, onRefresh,
}: {
  itemId: string; orderId: string; file: CartItemFile | null; onRefresh: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");

  async function uploadFile(f: File) {
    setStatus("uploading");
    try {
      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, type: "customer_upload", filename: f.name, mimeType: f.type || "application/octet-stream" }),
      });
      if (!presignRes.ok) { setStatus("error"); return; }
      const { uploadUrl, key } = await presignRes.json() as { uploadUrl: string; key: string };
      const putRes = await fetch(uploadUrl, { method: "PUT", body: f, headers: { "Content-Type": f.type || "application/octet-stream" } });
      if (!putRes.ok) { setStatus("error"); return; }
      await fetch("/api/uploads/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, itemId, key, filename: f.name, mimeType: f.type, replace: true }),
      });
      setStatus("done");
      await onRefresh();
    } catch { setStatus("error"); }
  }

  if (file) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 8, marginTop: 8 }}>
        <span style={{ fontSize: 16 }}>{file.mimeType?.startsWith("image/") ? "🖼️" : "📄"}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#14532D", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.filename ?? "Design"}</div>
        </div>
        <button onClick={() => inputRef.current?.click()} disabled={status === "uploading"}
          style={{ padding: "3px 8px", fontSize: 10, fontWeight: 700, background: "transparent", border: "1px solid #16A34A", borderRadius: 6, color: "#16A34A", cursor: "pointer", whiteSpace: "nowrap" }}>
          {status === "uploading" ? "…" : "Remplacer"}
        </button>
        <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.pdf,.ai,.svg" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f); }} />
      </div>
    );
  }
  return (
    <label style={{
      display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", marginTop: 8,
      background: "var(--grey-50)", border: `1px dashed ${status === "error" ? "var(--red)" : "var(--grey-200)"}`,
      borderRadius: 8, cursor: "pointer", fontSize: 11, color: "var(--grey-600)", fontFamily: "var(--font-mono), monospace",
    }}>
      <span>{status === "uploading" ? "⏳" : status === "done" ? "✅" : "⬆️"}</span>
      <span style={{ fontWeight: 600 }}>{status === "uploading" ? "Envoi…" : status === "error" ? "Erreur, réessayer" : "Ajouter mon design"}</span>
      <input type="file" accept=".png,.jpg,.jpeg,.pdf,.ai,.svg" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f); }} />
    </label>
  );
}

// ─── Stripe payment form (inside Elements provider) ───────────────────────────

function StripePaymentForm({ orderId, total }: { orderId: string; total: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    if (!stripe || !elements) return;
    setPaying(true);
    setError(null);

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/confirmation?order_id=${orderId}`,
      },
    });

    // confirmPayment redirects on success — we only get here if there's an error
    if (confirmError) {
      setError(confirmError.message ?? "Une erreur est survenue lors du paiement.");
      setPaying(false);
    }
  }

  return (
    <div>
      <PaymentElement options={{ layout: "tabs" }} />

      {error && (
        <div style={{ marginTop: 12, padding: "10px 14px", background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 8, fontSize: 13, color: "#991B1B" }}>
          ⚠️ {error}
        </div>
      )}

      <button
        onClick={() => void handlePay()}
        disabled={paying || !stripe}
        style={{
          marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          width: "100%", padding: "18px 28px",
          background: paying ? "var(--grey-400)" : "var(--red)",
          color: "var(--white)", border: "2px solid var(--ink)", borderRadius: "var(--r)",
          fontFamily: "var(--font-mono), monospace", fontWeight: 600, fontSize: 14,
          cursor: paying ? "not-allowed" : "pointer",
        }}
      >
        {paying ? "Paiement en cours…" : `Payer · ${(total / 100).toFixed(2)} €`}
        {!paying && <ArrowIcon />}
      </button>

      <div style={{ marginTop: 12, padding: 12, background: "var(--grey-50)", borderRadius: 8, fontSize: 11, color: "var(--grey-600)", display: "flex", alignItems: "center", gap: 8 }}>
        <ShieldIcon size={14} /> Paiement sécurisé · Stripe · SSL · 3D Secure
      </div>
    </div>
  );
}

// ─── Auth wall ────────────────────────────────────────────────────────────────

function AuthWall({ onContinueAsGuest }: { onContinueAsGuest: () => void }) {
  return (
    <div style={{ background: "var(--white)", border: "1.5px solid var(--grey-200)", borderRadius: "var(--r-lg)", padding: 28, marginBottom: 20 }}>
      <div style={{ fontSize: 11, color: "var(--red)", fontWeight: 700, letterSpacing: "0.15em", marginBottom: 8 }}>◆ IDENTIFICATION</div>
      <h3 style={{ fontSize: 22, fontFamily: "var(--font-archivo), system-ui, sans-serif", fontWeight: 800, marginBottom: 20 }}>Accéder à votre commande</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Link href="/login?redirect=/checkout" style={{ display: "flex", flexDirection: "column", gap: 6, padding: 20, border: "2px solid var(--ink)", borderRadius: "var(--r)", background: "var(--ink)", color: "var(--white)", textDecoration: "none" }}>
          <div style={{ fontSize: 20 }}>👤</div>
          <div style={{ fontFamily: "var(--font-archivo), system-ui, sans-serif", fontWeight: 800, fontSize: 16 }}>Se connecter</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.4 }}>Retrouvez vos commandes précédentes.</div>
        </Link>
        <Link href="/register?redirect=/checkout" style={{ display: "flex", flexDirection: "column", gap: 6, padding: 20, border: "2px solid var(--grey-200)", borderRadius: "var(--r)", background: "var(--white)", color: "var(--ink)", textDecoration: "none" }}>
          <div style={{ fontSize: 20 }}>✨</div>
          <div style={{ fontFamily: "var(--font-archivo), system-ui, sans-serif", fontWeight: 800, fontSize: 16 }}>Créer un compte</div>
          <div style={{ fontSize: 12, color: "var(--grey-600)", lineHeight: 1.4 }}>Suivi, historique et factures.</div>
        </Link>
      </div>
      <div style={{ marginTop: 16, textAlign: "center" }}>
        <button onClick={onContinueAsGuest} style={{ background: "transparent", border: "none", fontSize: 13, color: "var(--grey-600)", cursor: "pointer", textDecoration: "underline", fontFamily: "var(--font-mono), monospace", padding: "8px 0" }}>
          Continuer sans compte →
        </button>
      </div>
    </div>
  );
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  email: string; firstName: string; lastName: string;
  address: string; zip: string; city: string; phone: string;
  delivery: "standard" | "express";
  billingSameAsShipping: boolean;
  billingFirstName: string; billingLastName: string;
  billingAddress: string; billingZip: string; billingCity: string;
  acceptCGV: boolean;
  selectedShippingAddressId: string | null;
  // B2B / VAT
  isProfessional: boolean;
  countryCode: string;
  vatNumber: string;
  companyName: string;
}

interface FormErrors {
  email?: string; firstName?: string; lastName?: string;
  address?: string; zip?: string; city?: string; phone?: string;
  billingFirstName?: string; billingLastName?: string;
  billingAddress?: string; billingZip?: string; billingCity?: string;
  acceptCGV?: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CheckoutClient() {
  const { cart, updateQty, removeItem, isPending, refreshCart } = useCart();
  const { data: session, isPending: sessionLoading } = useSession();
  const isLoggedIn = !!session?.user;

  const [guestMode, setGuestMode] = useState<boolean | null>(null);
  const showForm = isLoggedIn || guestMode === true;

  // Saved addresses
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [saveNewAddress, setSaveNewAddress] = useState(false);

  // VAT validation state
  const [vatValidating, setVatValidating] = useState(false);
  const [vatResult, setVatResult] = useState<{ valid: boolean; companyName?: string | undefined; reverseCharge: boolean } | null>(null);

  // Computed VAT rate
  const effectiveVatRate = vatResult?.reverseCharge ? 0 : 0.20;
  const isReverseCharge = !!vatResult?.reverseCharge;

  async function handleValidateVat() {
    if (!form.vatNumber.trim()) return;
    setVatValidating(true);
    setVatResult(null);
    const res = await validateVatAction(form.vatNumber.trim());
    setVatValidating(false);
    if (res.ok) setVatResult({ valid: res.valid, companyName: res.companyName ?? undefined, reverseCharge: res.reverseCharge });
  }

  const [form, setForm] = useState<FormState>({
    email: "", firstName: "", lastName: "", address: "", zip: "", city: "", phone: "",
    delivery: "standard", billingSameAsShipping: true,
    billingFirstName: "", billingLastName: "", billingAddress: "", billingZip: "", billingCity: "",
    acceptCGV: false, selectedShippingAddressId: null,
    isProfessional: false, countryCode: "FR", vatNumber: "", companyName: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [processing, setProcessing] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Stripe embedded state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user) {
      const [first = "", ...rest] = (session.user.name ?? "").split(" ");
      setForm((f) => ({ ...f, email: session.user.email ?? f.email, firstName: first, lastName: rest.join(" ") }));
      // Load saved addresses
      getUserAddresses().then((addrs) => {
        setSavedAddresses(addrs);
        // Pre-fill with default address or the most recent one
        const defaultAddr = addrs.find((a) => a.isDefault) ?? addrs[0];
        if (defaultAddr) applyAddress(defaultAddr);
      }).catch(() => {});
    }
  }, [session]);

  const subTotal = cart.subtotalCents / 100;
  const shippingBase = form.delivery === "express" ? 9.9 : subTotal >= 50 ? 0 : 4.9;
  const shippingWithVat = shippingBase * (1 + effectiveVatRate);
  const vatAmount = subTotal * effectiveVatRate;
  const total = subTotal + vatAmount + shippingWithVat;

  function upd<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({
      ...f,
      [key]: value,
      // Reset selected address ID if user manually edits address fields
      ...(["address", "zip", "city"].includes(key as string) ? { selectedShippingAddressId: null } : {}),
    }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function applyAddress(addr: SavedAddress) {
    setForm((f) => ({
      ...f,
      firstName: addr.firstName ?? f.firstName,
      lastName: addr.lastName ?? f.lastName,
      address: addr.line1,
      zip: addr.postalCode,
      city: addr.city,
      phone: addr.phone ?? f.phone,
      selectedShippingAddressId: addr.id,
    }));
  }

  function validate(): boolean {
    const e: FormErrors = {};
    if (!isLoggedIn && !form.email.includes("@")) e.email = "Email invalide";
    if (!form.firstName.trim()) e.firstName = "Requis";
    if (!form.lastName.trim()) e.lastName = "Requis";
    if (!form.address.trim()) e.address = "Requis";
    if (!/^\d{5}$/.test(form.zip)) e.zip = "Code postal 5 chiffres";
    if (!form.city.trim()) e.city = "Requis";
    if (!/^\d{10}$/.test(form.phone.replace(/\s/g, ""))) e.phone = "Téléphone 10 chiffres";
    if (!form.billingSameAsShipping) {
      if (!form.billingFirstName.trim()) e.billingFirstName = "Requis";
      if (!form.billingLastName.trim()) e.billingLastName = "Requis";
      if (!form.billingAddress.trim()) e.billingAddress = "Requis";
      if (!/^\d{5}$/.test(form.billingZip)) e.billingZip = "Code postal 5 chiffres";
      if (!form.billingCity.trim()) e.billingCity = "Requis";
    }
    if (!form.acceptCGV) e.acceptCGV = "Merci d'accepter les CGV";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmitOrder() {
    if (!validate()) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setProcessing(true);
    setGlobalError(null);

    const emailToUse = isLoggedIn ? (session?.user.email ?? form.email) : form.email;
    const billing = form.billingSameAsShipping ? undefined : {
      firstName: form.billingFirstName, lastName: form.billingLastName,
      line1: form.billingAddress, postalCode: form.billingZip, city: form.billingCity, countryCode: "FR" as const,
    };

    const result = await submitOrder({
      firstName: form.firstName, lastName: form.lastName, email: emailToUse,
      phone: form.phone.replace(/\s/g, ""), line1: form.address,
      postalCode: form.zip, city: form.city, countryCode: form.countryCode || "FR",
      deliveryMethod: form.delivery, billing,
      selectedShippingAddressId: form.selectedShippingAddressId ?? undefined,
      isProfessional: form.isProfessional,
      vatNumber: form.isProfessional ? form.vatNumber : undefined,
      companyName: form.isProfessional ? form.companyName : undefined,
    });

    setProcessing(false);

    if (!result.ok) {
      setGlobalError(result.error);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (result.data.clientSecret) {
      // Optionally save the address
      if (saveNewAddress && isLoggedIn && !form.selectedShippingAddressId) {
        void saveAddress({
          label: "Adresse enregistrée",
          firstName: form.firstName,
          lastName: form.lastName,
          line1: form.address,
          postalCode: form.zip,
          city: form.city,
          countryCode: "FR",
          phone: form.phone.replace(/\s/g, ""),
          isDefault: savedAddresses.length === 0,
        });
      }
      setClientSecret(result.data.clientSecret);
      setCheckoutOrderId(result.data.orderId);
      // Scroll to payment section
      setTimeout(() => {
        document.getElementById("stripe-payment-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    } else {
      setGlobalError("Impossible d'initialiser le paiement. Veuillez réessayer.");
    }
  }

  if (cart.items.length === 0 && !clientSecret) {
    return (
      <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: 40, background: "var(--cream)" }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🛒</div>
          <h2 style={{ fontSize: 28, marginBottom: 12, fontFamily: "var(--font-archivo), system-ui, sans-serif", fontWeight: 800 }}>Panier vide</h2>
          <Link href="/custom-stickers" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "18px 28px", background: "var(--red)", color: "var(--white)", border: "2px solid var(--ink)", borderRadius: "var(--r)", fontFamily: "var(--font-mono), monospace", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
            Configurer un sticker
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ background: "var(--cream)", minHeight: "100vh" }}>
      {/* Header */}
      <section style={{ background: "var(--white)", borderBottom: "2px solid var(--ink)", padding: "32px 0" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.15em", color: "var(--red)", fontWeight: 700, marginBottom: 8 }}>◆ FINALISATION</div>
          <h1 style={{ fontSize: 42, fontFamily: "var(--font-archivo), system-ui, sans-serif", fontWeight: 800 }}>Votre commande</h1>
          <div style={{ display: "flex", gap: 24, marginTop: 24, fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", flexWrap: "wrap" }}>
            {["Panier", "Livraison", "Facturation", "Paiement"].map((s, i) => {
              const done = i === 0 || (i === 1 && !!clientSecret) || (i === 2 && !!clientSecret) || (i === 3 && false);
              const active = (i === 0 && !clientSecret) || (i === 3 && !!clientSecret);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, color: done || active ? "var(--ink)" : "var(--grey-400)" }}>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", background: active ? "var(--red)" : done ? "#16A34A" : "var(--grey-200)", color: "var(--white)", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                    {done && i < 3 ? "✓" : i + 1}
                  </span>
                  {s}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section style={{ padding: "40px 0" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 32, alignItems: "flex-start" }}>

          {/* Left: forms */}
          <div>
            {globalError && (
              <div style={{ marginBottom: 16, padding: "12px 16px", background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 8, fontSize: 13, color: "#991B1B" }}>
                ⚠️ {globalError}
              </div>
            )}

            {/* ── PANIER ────────────────────────────────────────── */}
            {!clientSecret && (
              <FormCard num="01" title="Votre panier">
                {cart.items.length === 0 ? (
                  <p style={{ color: "var(--grey-600)", fontSize: 14 }}>Aucun article dans le panier.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {cart.items.map((item) => (
                      <div key={item.id} style={{ background: "var(--grey-50)", border: "1px solid var(--grey-200)", borderRadius: "var(--r)", padding: 14, display: "flex", gap: 12 }}>
                        {/* Shape icon */}
                        <div style={{ width: 56, height: 56, background: "var(--white)", borderRadius: 8, display: "grid", placeItems: "center", border: "1px dashed var(--grey-200)", flexShrink: 0, fontSize: 22 }}>
                          {item.shape === "circle" ? "⬤" : item.shape === "die-cut" ? "⬟" : "■"}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{item.productName}</div>
                              <div style={{ fontSize: 11, color: "var(--grey-600)", marginTop: 2 }}>
                                {item.shape} · {item.widthMm}×{item.heightMm} mm · {item.material}
                              </div>
                            </div>
                            <button
                              onClick={() => void removeItem(item.id)}
                              disabled={isPending}
                              style={{ background: "transparent", border: "none", color: "var(--grey-400)", cursor: "pointer", padding: 4, flexShrink: 0 }}
                            >
                              <TrashIcon />
                            </button>
                          </div>

                          {/* Qty controls */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--ink)", borderRadius: 6 }}>
                              <button
                                style={{ background: "transparent", border: "none", width: 28, height: 28, cursor: "pointer", fontSize: 14, fontWeight: 700 }}
                                onClick={() => void updateQty(item.id, Math.max(1, item.quantity - 25))} disabled={isPending}
                              >−</button>
                              <span style={{ padding: "0 10px", fontSize: 12, fontWeight: 600 }}>{item.quantity}</span>
                              <button
                                style={{ background: "transparent", border: "none", width: 28, height: 28, cursor: "pointer", fontSize: 14, fontWeight: 700 }}
                                onClick={() => void updateQty(item.id, item.quantity + 25)} disabled={isPending}
                              >+</button>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{(item.lineTotalCents / 100).toFixed(2)} €</div>
                          </div>

                          {/* File zone */}
                          <CartItemFileZoneCheckout
                            itemId={item.id}
                            orderId={cart.orderId}
                            file={item.file}
                            onRefresh={refreshCart}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Continue shopping */}
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px dashed var(--grey-200)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Link
                    href="/custom-stickers"
                    style={{ fontSize: 13, color: "var(--blue)", textDecoration: "underline", fontFamily: "var(--font-mono), monospace", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    ← Continuer mes achats
                  </Link>
                  <span style={{ fontSize: 12, color: "var(--grey-600)" }}>{cart.items.length} article{cart.items.length > 1 ? "s" : ""}</span>
                </div>
              </FormCard>
            )}

            {/* ── AUTH / FORM ──────────────────────────────────── */}
            {!clientSecret && !sessionLoading && !isLoggedIn && guestMode !== true && (
              <AuthWall onContinueAsGuest={() => setGuestMode(true)} />
            )}

            {!clientSecret && isLoggedIn && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: "var(--r)", marginBottom: 20, fontSize: 13 }}>
                <span style={{ fontSize: 20 }}>✅</span>
                <div>
                  <span style={{ fontWeight: 700 }}>Connecté</span> en tant que{" "}
                  <span style={{ color: "var(--blue)", fontWeight: 600 }}>{session?.user.email}</span>
                </div>
              </div>
            )}

            {!clientSecret && showForm && (
              <>
                {/* Livraison */}
                <FormCard num="02" title="Livraison">
                  {savedAddresses.length > 0 && (
                    <AddressSelector
                      addresses={savedAddresses}
                      onSelect={applyAddress}
                    />
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {isLoggedIn ? (
                      <InputField label="Email" value={session?.user.email ?? ""} readOnly span={2} />
                    ) : (
                      <InputField label="Email" value={form.email} onChange={(v) => upd("email", v)} error={errors.email} placeholder="vous@exemple.fr" type="email" span={2} />
                    )}
                    <InputField label="Prénom" value={form.firstName} onChange={(v) => upd("firstName", v)} error={errors.firstName} />
                    <InputField label="Nom" value={form.lastName} onChange={(v) => upd("lastName", v)} error={errors.lastName} />
                    <InputField label="Adresse" value={form.address} onChange={(v) => upd("address", v)} error={errors.address} placeholder="12 rue Victor Hugo" span={2} />
                    <InputField label="Code postal" value={form.zip} onChange={(v) => upd("zip", v.replace(/\D/g, "").slice(0, 5))} error={errors.zip} />
                    <InputField label="Ville" value={form.city} onChange={(v) => upd("city", v)} error={errors.city} />
                    <InputField label="Téléphone" value={form.phone} onChange={(v) => upd("phone", v)} error={errors.phone} placeholder="06 12 34 56 78" span={2} />
                  </div>

                  {/* B2B / Professional fields */}
                  <div style={{ marginTop: 16 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "12px 14px", background: form.isProfessional ? "#FEF2F2" : "var(--grey-50)", border: `1.5px solid ${form.isProfessional ? "var(--red)" : "var(--grey-200)"}`, borderRadius: "var(--r)", fontSize: 13 }}>
                      <input type="checkbox" checked={form.isProfessional} onChange={(e) => { upd("isProfessional", e.target.checked); setVatResult(null); }} style={{ width: 16, height: 16, accentColor: "var(--red)" }} />
                      <div>
                        <div style={{ fontWeight: 700 }}>Commande professionnelle (B2B)</div>
                        <div style={{ fontSize: 11, color: "var(--grey-500)" }}>Saisissez votre numéro de TVA pour bénéficier de l&apos;exonération si applicable</div>
                      </div>
                    </label>

                    {form.isProfessional && (
                      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                        <InputField label="Raison sociale" value={form.companyName} onChange={(v) => upd("companyName", v)} placeholder="Acme SAS" span={2} />
                        <div style={{ gridColumn: "span 2" }}>
                          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--grey-600)", marginBottom: 6, display: "block" }}>
                            Pays de livraison
                          </label>
                          <select
                            value={form.countryCode}
                            onChange={(e) => { upd("countryCode", e.target.value); setVatResult(null); }}
                            style={{ width: "100%", padding: "12px 14px", border: "1.5px solid var(--grey-200)", borderRadius: 8, fontSize: 13, background: "var(--white)", outline: "none" }}
                          >
                            <option value="FR">France</option>
                            <option value="BE">Belgique</option>
                            <option value="DE">Allemagne</option>
                            <option value="ES">Espagne</option>
                            <option value="IT">Italie</option>
                            <option value="LU">Luxembourg</option>
                            <option value="NL">Pays-Bas</option>
                            <option value="CH">Suisse (hors UE)</option>
                            <option value="GB">Royaume-Uni (hors UE)</option>
                          </select>
                        </div>

                        {form.countryCode !== "FR" && (
                          <div style={{ gridColumn: "span 2" }}>
                            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--grey-600)", marginBottom: 6, display: "block" }}>
                              N° TVA intracommunautaire
                            </label>
                            <div style={{ display: "flex", gap: 8 }}>
                              <input
                                type="text"
                                value={form.vatNumber}
                                onChange={(e) => { upd("vatNumber", e.target.value.toUpperCase()); setVatResult(null); }}
                                placeholder="FR12345678901"
                                style={{ flex: 1, padding: "12px 14px", border: `1.5px solid ${vatResult ? (vatResult.valid ? "#86EFAC" : "#FCA5A5") : "var(--grey-200)"}`, borderRadius: 8, fontSize: 13, fontFamily: "var(--font-mono), monospace", outline: "none" }}
                              />
                              <button
                                type="button"
                                onClick={() => void handleValidateVat()}
                                disabled={vatValidating || !form.vatNumber}
                                style={{ padding: "0 16px", background: "var(--ink)", color: "var(--white)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                              >
                                {vatValidating ? "…" : "Vérifier"}
                              </button>
                            </div>
                            {vatResult && (
                              <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 6, background: vatResult.valid ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${vatResult.valid ? "#86EFAC" : "#FCA5A5"}`, fontSize: 12 }}>
                                {vatResult.valid ? (
                                  <>
                                    <span style={{ color: "#166534", fontWeight: 700 }}>✓ N° TVA valide</span>
                                    {vatResult.companyName && <span style={{ color: "#166534" }}> — {vatResult.companyName}</span>}
                                    {vatResult.reverseCharge && (
                                      <div style={{ marginTop: 4, color: "#166534" }}>
                                        🎉 Autoliquidation applicable — TVA = 0%
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <span style={{ color: "#DC2626", fontWeight: 700 }}>✗ N° TVA invalide ou introuvable</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 24 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--grey-600)", marginBottom: 8, display: "block" }}>Mode de livraison</label>
                    <div style={{ display: "grid", gap: 10 }}>
                      <DeliveryOption active={form.delivery === "standard"} onClick={() => upd("delivery", "standard")} icon={<TruckIcon />} title="Colissimo standard" sub="2-3 jours ouvrés · suivi" price={subTotal >= 50 ? "OFFERT" : "4,90 €"} />
                      <DeliveryOption active={form.delivery === "express"} onClick={() => upd("delivery", "express")} icon={<SparklesIcon />} title="Chronopost Express" sub="Demain avant 13h" price="9,90 €" />
                    </div>
                  </div>
                </FormCard>

                {/* Facturation */}
                <FormCard num="03" title="Facturation">
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, marginBottom: 16, padding: "12px 14px", background: form.billingSameAsShipping ? "#F0FDF4" : "var(--white)", border: `1.5px solid ${form.billingSameAsShipping ? "#86EFAC" : "var(--grey-200)"}`, borderRadius: "var(--r)" }}>
                    <input type="checkbox" checked={form.billingSameAsShipping} onChange={(e) => upd("billingSameAsShipping", e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--red)" }} />
                    <span style={{ fontWeight: 600 }}>Même adresse que la livraison</span>
                  </label>
                  {!form.billingSameAsShipping && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <InputField label="Prénom" value={form.billingFirstName} onChange={(v) => upd("billingFirstName", v)} error={errors.billingFirstName} />
                      <InputField label="Nom" value={form.billingLastName} onChange={(v) => upd("billingLastName", v)} error={errors.billingLastName} />
                      <InputField label="Adresse" value={form.billingAddress} onChange={(v) => upd("billingAddress", v)} error={errors.billingAddress} placeholder="12 rue Victor Hugo" span={2} />
                      <InputField label="Code postal" value={form.billingZip} onChange={(v) => upd("billingZip", v.replace(/\D/g, "").slice(0, 5))} error={errors.billingZip} />
                      <InputField label="Ville" value={form.billingCity} onChange={(v) => upd("billingCity", v)} error={errors.billingCity} />
                    </div>
                  )}
                </FormCard>

                {/* Save address + CGV + submit */}
                <div style={{ padding: "16px 0", fontSize: 13 }}>
                  {isLoggedIn && (
                    <label style={{ display: "flex", gap: 10, cursor: "pointer", alignItems: "center", marginBottom: 14, padding: "12px 14px", background: saveNewAddress ? "#FEF2F2" : "var(--grey-50)", border: `1.5px solid ${saveNewAddress ? "var(--red)" : "var(--grey-200)"}`, borderRadius: "var(--r)" }}>
                      <input type="checkbox" checked={saveNewAddress} onChange={(e) => setSaveNewAddress(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--red)" }} />
                      <span style={{ fontWeight: 600 }}>Enregistrer cette adresse pour mes prochaines commandes</span>
                    </label>
                  )}
                  <label style={{ display: "flex", gap: 10, cursor: "pointer", alignItems: "flex-start" }}>
                    <input type="checkbox" checked={form.acceptCGV} onChange={(e) => upd("acceptCGV", e.target.checked)} style={{ marginTop: 2, width: 16, height: 16, accentColor: "var(--red)" }} />
                    <span>
                      J&apos;accepte les{" "}
                      <Link href="/cgv" style={{ textDecoration: "underline", color: "var(--blue)" }}>CGV</Link>{" "}
                      et la{" "}
                      <Link href="/politique-confidentialite" style={{ textDecoration: "underline", color: "var(--blue)" }}>politique de confidentialité</Link>.
                    </span>
                  </label>
                  {errors.acceptCGV && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4, marginLeft: 26 }}>{errors.acceptCGV}</div>}
                </div>

                <button
                  onClick={() => void handleSubmitOrder()}
                  disabled={processing}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    width: "100%", padding: "18px 28px",
                    background: processing ? "var(--grey-400)" : "var(--red)",
                    color: "var(--white)", border: "2px solid var(--ink)", borderRadius: "var(--r)",
                    fontFamily: "var(--font-mono), monospace", fontWeight: 600, fontSize: 14,
                    cursor: processing ? "not-allowed" : "pointer",
                  }}
                >
                  {processing ? "Préparation du paiement…" : `Procéder au paiement · ${total.toFixed(2)} €`}
                  {!processing && <ArrowIcon />}
                </button>
              </>
            )}

            {/* ── STRIPE PAYMENT SECTION ──────────────────────── */}
            {clientSecret && checkoutOrderId && (
              <div id="stripe-payment-section">
                <FormCard num="04" title="Paiement sécurisé">
                  <div style={{ marginBottom: 16, padding: "10px 14px", background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 8, fontSize: 13, color: "#14532D", display: "flex", alignItems: "center", gap: 8 }}>
                    ✅ Commande créée — complétez le paiement ci-dessous
                  </div>
                  <Elements
                    stripe={stripePromise}
                    options={{
                      clientSecret,
                      locale: "fr",
                      appearance: {
                        theme: "stripe",
                        variables: {
                          colorPrimary: "#DC2626",
                          colorBackground: "#ffffff",
                          borderRadius: "8px",
                          fontFamily: "system-ui, sans-serif",
                        },
                      },
                    }}
                  >
                    <StripePaymentForm orderId={checkoutOrderId} total={Math.round(total * 100)} />
                  </Elements>
                </FormCard>
              </div>
            )}
          </div>

          {/* Right: order summary */}
          <div style={{ position: "sticky", top: 100 }}>
            <div style={{ background: "var(--white)", border: "2px solid var(--ink)", borderRadius: "var(--r-lg)", overflow: "hidden", boxShadow: "6px 6px 0 0 var(--ink)" }}>
              <div style={{ background: "var(--ink)", color: "var(--white)", padding: "14px 20px", fontSize: 11, letterSpacing: "0.15em", fontWeight: 700 }}>◆ RÉCAPITULATIF</div>
              <div style={{ padding: 20 }}>
                {cart.items.map((item) => (
                  <div key={item.id} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 48, height: 48, background: "var(--grey-50)", borderRadius: 8, display: "grid", placeItems: "center", flexShrink: 0, border: "1px dashed var(--grey-200)", fontSize: 18 }}>
                      {item.shape === "circle" ? "⬤" : item.shape === "die-cut" ? "⬟" : "■"}
                    </div>
                    <div style={{ flex: 1, fontSize: 12 }}>
                      <div style={{ fontWeight: 700 }}>{item.productName}</div>
                      <div style={{ color: "var(--grey-600)", marginTop: 2 }}>{item.shape} · {item.widthMm}×{item.heightMm} mm · ×{item.quantity}</div>
                      {item.file && <div style={{ fontSize: 10, color: "#16A34A", marginTop: 2 }}>✅ {item.file.filename ?? "Design attaché"}</div>}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{(item.lineTotalCents / 100).toFixed(2)} €</div>
                  </div>
                ))}

                <div style={{ borderTop: "1px dashed var(--grey-200)", paddingTop: 14, fontSize: 13, color: "var(--grey-600)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span>Sous-total HT</span><span>{subTotal.toFixed(2)} €</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span>Livraison</span>
                    <span style={{ color: shippingBase === 0 ? "var(--red)" : "inherit", fontWeight: shippingBase === 0 ? 700 : 400 }}>
                      {shippingBase === 0 ? "OFFERTE" : `${shippingWithVat.toFixed(2)} €`}
                    </span>
                  </div>
                  {isReverseCharge ? (
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11, color: "#166534", fontWeight: 700 }}>
                      <span>TVA (autoliquidation)</span><span>0,00 €</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11 }}>
                      <span>Dont TVA {Math.round(effectiveVatRate * 100)}%</span>
                      <span>{vatAmount.toFixed(2)} €</span>
                    </div>
                  )}
                </div>

                <div style={{ borderTop: "2px solid var(--ink)", paddingTop: 14, marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>TOTAL TTC</span>
                  <span style={{ fontFamily: "var(--font-archivo), system-ui, sans-serif", fontSize: 30, fontWeight: 800 }}>{total.toFixed(2)} €</span>
                </div>

                {isReverseCharge && (
                  <div style={{ marginTop: 8, padding: "8px 12px", background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 6, fontSize: 11, color: "#166534" }}>
                    Autoliquidation de TVA — Art. 283-2 du CGI. TVA due par le preneur assujetti.
                  </div>
                )}

                <div style={{ marginTop: 14, padding: 12, background: "var(--grey-50)", borderRadius: 8, fontSize: 11, color: "var(--grey-600)", display: "flex", alignItems: "center", gap: 8 }}>
                  <ShieldIcon size={14} /> Paiement sécurisé · Stripe · SSL
                </div>
              </div>
            </div>

            {/* Trust badges */}
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8, fontSize: 12, color: "var(--grey-600)" }}>
              {["🔒 Paiement 100% sécurisé", "🚀 Production sous 24-48h", "📦 Livraison suivie", "✉️ BAT avant production"].map((b) => (
                <div key={b} style={{ display: "flex", alignItems: "center", gap: 8 }}>{b}</div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
