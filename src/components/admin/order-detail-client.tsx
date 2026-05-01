"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@/lib/order-state";
import type { AddressData } from "@/lib/admin-actions";
import { changeOrderStatus, addInternalNote, uploadProof, refundOrder, generateInvoice, refreshInvoiceUrl, replyToRevision, createShipment, getSendCloudShippingMethods, markPaidByTransfer, sendAdminPaymentLink } from "@/lib/admin-actions";

const STATUS_LABELS: Record<string, string> = {
  proof_pending: "En attente de paiement",
  proof_sent: "BAT envoyé au client",
  proof_revision_requested: "Révision demandée",
  approved: "BAT validé — lancer la production",
  paid: "Payé — préparer le BAT",
  in_production: "En production",
  shipped: "Expédié",
  delivered: "Livré",
  cancelled: "Annulé",
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  proof_pending:            { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" },
  proof_sent:               { bg: "#DBEAFE", text: "#1E40AF", border: "#93C5FD" },
  proof_revision_requested: { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" },
  approved:                 { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" },
  paid:                     { bg: "#EDE9FE", text: "#5B21B6", border: "#C4B5FD" },
  in_production:            { bg: "#FCE7F3", text: "#9D174D", border: "#F9A8D4" },
  shipped:                  { bg: "#CFFAFE", text: "#164E63", border: "#67E8F9" },
  delivered:                { bg: "#DCFCE7", text: "#14532D", border: "#86EFAC" },
  cancelled:                { bg: "#F3F4F6", text: "#6B7280", border: "#D1D5DB" },
};

const STATUS_NEXT_LABELS: Record<string, string> = {
  paid: "Paiement reçu",
  proof_sent: "BAT envoyé au client",
  approved: "BAT validé par le client",
  in_production: "Lancer la production",
  shipped: "Marquer comme expédié",
  delivered: "Marquer comme livré",
  cancelled: "Annuler la commande",
  proof_revision_requested: "Révision demandée par le client",
};

function euros(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

const EVENT_ICONS: Record<string, string> = {
  "order.submitted":          "📥",
  "proof.uploaded":           "🖼️",
  "proof.approved":           "✅",
  "proof.revision_requested": "↩️",
  "payment.received":         "💳",
  "production.started":       "🏭",
  "order.shipped":            "🚚",
  "order.delivered":          "🎉",
  "order.cancelled":          "❌",
  "order.partial_refund":     "↩️",
  "order.refunded":           "💸",
  "admin.note_added":         "📝",
  "admin.revision_reply":     "💬",
  "sendcloud.parcel_created": "📦",
  "sendcloud.order_created":  "📥",
  "sendcloud.error":          "⚠️",
  "sendcloud.status_update":  "🚚",
  "payment.link_sent":        "🔗",
  "pennylane.invoice_created":"🧾",
  "pennylane.error":          "⚠️",
};

const EVENT_LABELS: Record<string, string> = {
  "order.submitted":          "Commande reçue",
  "proof.uploaded":           "BAT envoyé au client",
  "proof.approved":           "BAT approuvé par le client",
  "proof.revision_requested": "Révision demandée par le client",
  "payment.received":         "Paiement reçu",
  "production.started":       "Mise en production",
  "order.shipped":            "Commande expédiée",
  "order.delivered":          "Commande livrée",
  "order.cancelled":          "Commande annulée",
  "order.partial_refund":     "Remboursement partiel effectué",
  "order.refunded":           "Remboursement total effectué",
  "payment.refunded":         "Remboursement confirmé par Stripe",
  "admin.note_added":         "Note interne ajoutée",
  "admin.revision_reply":     "Réponse à la révision envoyée au client",
  "sendcloud.parcel_created": "Colis créé sur SendCloud",
  "sendcloud.order_created":  "Commande importée dans SendCloud",
  "sendcloud.error":          "Erreur SendCloud",
  "sendcloud.status_update":  "Mise à jour transporteur",
  "payment.link_sent":        "Lien de paiement envoyé au client",
  "pennylane.invoice_created":"Facture Pennylane générée",
  "pennylane.error":          "Erreur Pennylane",
};

interface SerializedOrder {
  id: string;
  status: string;
  totalCents: number;
  subtotalCents: number;
  taxAmountCents: number;
  shippingCents: number;
  deliveryMethod: string | null;
  guestEmail: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  internalNotes: string | null;
  vatRate: string | null;
  stripePaymentIntentId: string | null;
  pennylaneInvoiceUrl: string | null;
  pennylaneInvoiceId: string | null;
  sendcloudParcelId: string | null;
  shippingLabelUrl: string | null;
  userId: string | null;
  customerName: string | null;
  customerEmail: string | null;
}

interface SerializedItem {
  id: string;
  quantity: number;
  widthMm: number;
  heightMm: number;
  shape: string;
  finish: string;
  unitPriceCents: number;
  lineTotalCents: number;
  customizationNote: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SerializedEvent {
  id: string;
  type: string;
  payload: unknown;
  createdAt: string;
}

interface SerializedFile {
  id: string;
  type: string;
  version: number;
  storageKey: string;
  mimeType: string | null;
  originalFilename: string | null;
  sizeBytes: number | null;
  uploadedById: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  detail: {
    order: SerializedOrder;
    shippingAddress: AddressData;
    billingAddress: AddressData;
    items: SerializedItem[];
    events: SerializedEvent[];
    files: SerializedFile[];
    nextStatuses: OrderStatus[];
  };
}

function FileRow({ file, orderId }: { file: SerializedFile; orderId: string }) {
  const [loading, setLoading] = useState(false);
  const typeLabel = file.type === "customer_upload" ? "Client" : file.type === "proof" ? `BAT v${file.version}` : "Artwork";
  const typeColor = file.type === "customer_upload" ? { bg: "#EFF6FF", text: "#1E40AF", border: "#93C5FD" } : { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" };

  async function download() {
    setLoading(true);
    try {
      const proxyUrl = `/api/uploads/download?key=${encodeURIComponent(file.storageKey)}&orderId=${encodeURIComponent(orderId)}&download=1`;
      window.open(proxyUrl, "_blank");
    } finally { setLoading(false); }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#F9FAFB", borderRadius: 8, border: "1px solid #E5E7EB" }}>
      <span style={{ fontSize: 20 }}>
        {file.type === "customer_upload" ? "🖼️" : "📄"}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "#0A0E27", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {file.originalFilename ?? file.storageKey}
        </div>
        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
          {new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(file.createdAt))}
          {file.mimeType && <span style={{ marginLeft: 8 }}>{file.mimeType}</span>}
        </div>
      </div>
      <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: typeColor.bg, color: typeColor.text, border: `1px solid ${typeColor.border}`, flexShrink: 0, letterSpacing: "0.03em" }}>
        {typeLabel}
      </span>
      <button
        onClick={() => void download()}
        disabled={loading}
        style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, background: "#0A0E27", color: "#fff", border: "none", borderRadius: 6, cursor: loading ? "not-allowed" : "pointer", flexShrink: 0, opacity: loading ? 0.6 : 1 }}
      >
        {loading ? "…" : "Télécharger"}
      </button>
    </div>
  );
}

function RefreshInvoiceButton({ orderId, pennylaneInvoiceId }: { orderId: string; pennylaneInvoiceId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [noUrl, setNoUrl] = useState(false);

  const handleRefresh = () => {
    setErr(null);
    setNoUrl(false);
    startTransition(async () => {
      const res = await refreshInvoiceUrl(orderId);
      if (res.ok) {
        if (res.data.invoiceUrl) {
          router.refresh();
        } else {
          setNoUrl(true);
        }
      } else {
        setErr(res.error ?? "Erreur inconnue");
      }
    });
  };

  return (
    <section style={{ ...sectionStyle, border: "1px solid #A7F3D0", background: "#ECFDF5" }}>
      <h2 style={{ ...sectionTitleStyle, color: "#065F46" }}>🧾 Facture</h2>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 8 }}>
        Facture créée dans Pennylane (ID&nbsp;: <strong>{pennylaneInvoiceId}</strong>).
        {noUrl && " Le PDF n'est pas encore disponible, réessayez dans quelques secondes."}
      </p>
      {err && <p style={{ fontSize: 13, color: "#DC2626", marginBottom: 8 }}>{err}</p>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={handleRefresh}
          disabled={isPending}
          style={{
            padding: "9px 14px", background: isPending ? "#9CA3AF" : "#065F46",
            color: "#fff", border: "none", borderRadius: 8, cursor: isPending ? "not-allowed" : "pointer",
            fontSize: 13, fontWeight: 700,
          }}
        >
          {isPending ? "Récupération…" : "🔄 Récupérer l'URL du PDF"}
        </button>
        <a
          href={`https://app.pennylane.com/customer_invoices/${pennylaneInvoiceId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: "9px 14px", background: "#fff", border: "1.5px solid #065F46", color: "#065F46", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 700 }}
        >
          🔗 Voir dans Pennylane
        </a>
      </div>
    </section>
  );
}

function GenerateInvoiceButton({ orderId }: { orderId: string }) {  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleGenerate = () => {
    setErr(null);
    startTransition(async () => {
      const res = await generateInvoice(orderId);
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else {
        setErr(res.error ?? "Erreur inconnue");
      }
    });
  };

  if (done) return null;

  return (
    <section style={{ background: "#F9FAFB", border: "1px solid #D1D5DB", borderRadius: 12, padding: "20px 24px" }}>
      <h2 style={{ fontFamily: "var(--font-archivo), system-ui, sans-serif", fontSize: 14, fontWeight: 800, color: "#0A0E27", margin: "0 0 16px 0" }}>🧾 Facture</h2>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>Aucune facture Pennylane n'a encore été générée pour cette commande.</p>
      {err && <p style={{ fontSize: 13, color: "#DC2626", marginBottom: 8 }}>{err}</p>}
      <button
        onClick={handleGenerate}
        disabled={isPending}
        style={{
          padding: "10px 16px", background: isPending ? "#9CA3AF" : "#0A0E27",
          color: "#fff", border: "none", borderRadius: 8, cursor: isPending ? "not-allowed" : "pointer",
          fontSize: 13, fontWeight: 700,
        }}
      >
        {isPending ? "Génération…" : "📄 Générer la facture Pennylane"}
      </button>
    </section>
  );
}

// ─── SendCloud shipment section ───────────────────────────────────────────────

function ShipmentSection({
  orderId,
  sendcloudParcelId,
  shippingLabelUrl,
  trackingNumber,
  trackingCarrier,
}: {
  orderId: string;
  sendcloudParcelId: string | null;
  shippingLabelUrl: string | null;
  trackingNumber: string | null;
  trackingCarrier: string | null;
}) {
  const router = useRouter();
  const [methods, setMethods] = useState<Array<{ id: number; name: string; carrier: string; shipping_option_code: string }>>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [weightGrams, setWeightGrams] = useState("200");
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function loadMethods() {
    if (methods.length > 0) return;
    setLoadingMethods(true);
    getSendCloudShippingMethods("FR").then((res) => {
      setLoadingMethods(false);
      if (res.ok) {
        const mapped = res.data.map((m) => ({ id: m.id, name: m.name, carrier: m.carrier, shipping_option_code: m.shipping_option_code }));
        setMethods(mapped);
        if (mapped.length > 0 && !selectedCode) setSelectedCode(mapped[0]!.shipping_option_code);
      } else setErr(res.error);
    });
  }

  function handleCreate() {
    if (!selectedCode || !weightGrams) return;
    setErr(null);
    startTransition(async () => {
      const res = await createShipment(orderId, {
        shippingOptionCode: selectedCode,
        weightGrams: Number(weightGrams),
      });
      if (res.ok) {
        setShowForm(false);
        router.refresh();
      } else {
        setErr(res.error);
      }
    });
  }

  const sectionStyle: React.CSSProperties = { background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", padding: "20px 24px", marginBottom: 16 };

  // Already created
  if (sendcloudParcelId) {
    return (
      <section style={sectionStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0A0E27", marginBottom: 12 }}>📦 Expédition SendCloud</h2>
        <div style={{ fontSize: 13, color: "#374151", display: "flex", flexDirection: "column", gap: 6 }}>
          <div>Colis n° <strong>{sendcloudParcelId}</strong></div>
          {trackingNumber && (
            <div>Suivi : <strong>{trackingCarrier ? `${trackingCarrier} — ` : ""}{trackingNumber}</strong></div>
          )}
        </div>
        {shippingLabelUrl && (
          <a
            href={shippingLabelUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-block", marginTop: 12, padding: "8px 16px", background: "#0A0E27", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}
          >
            🖨️ Télécharger l&rsquo;étiquette PDF
          </a>
        )}
      </section>
    );
  }

  return (
    <section style={sectionStyle}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0A0E27", marginBottom: 12 }}>📦 Expédition SendCloud</h2>
      {!showForm ? (
        <button
          onClick={() => { setShowForm(true); loadMethods(); }}
          style={{ padding: "8px 16px", background: "#0A0E27", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          + Générer une étiquette d&rsquo;expédition
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Transporteur / méthode</label>
            {loadingMethods ? (
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>Chargement des méthodes…</div>
            ) : (
              <select
                value={selectedCode}
                onChange={(e) => setSelectedCode(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #D1D5DB", borderRadius: 6 }}
              >
                <option value="">— Choisir une méthode —</option>
                {methods.map((m) => (
                  <option key={m.shipping_option_code} value={m.shipping_option_code}>{m.carrier} — {m.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Poids du colis (grammes)</label>
            <input
              type="number"
              min="1"
              value={weightGrams}
              onChange={(e) => setWeightGrams(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #D1D5DB", borderRadius: 6 }}
            />
          </div>
          {err && <div style={{ fontSize: 12, color: "#DC2626", background: "#FEF2F2", padding: "6px 10px", borderRadius: 4 }}>{err}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
            disabled={!selectedCode || !weightGrams || isPending}
            onClick={handleCreate}
            style={{ padding: "8px 16px", background: "#DC2626", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: !selectedCode || isPending ? "not-allowed" : "pointer", opacity: !selectedCode || isPending ? 0.5 : 1 }}
            >
              {isPending ? "Création…" : "Créer le colis & l'étiquette"}
            </button>
            <button
              onClick={() => { setShowForm(false); setErr(null); }}
              style={{ padding: "8px 12px", fontSize: 13, background: "none", border: "1px solid #D1D5DB", borderRadius: 8, cursor: "pointer", color: "#6B7280" }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function OrderDetailClient({ detail }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "">("");
  const [trackingNumber, setTrackingNumber] = useState(detail.order.trackingNumber ?? "");
  const [trackingCarrier, setTrackingCarrier] = useState(detail.order.trackingCarrier ?? "");
  const [statusNote, setStatusNote] = useState("");
  const [noteText, setNoteText] = useState(detail.order.internalNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // BAT upload state
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Refund state
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState<"duplicate" | "fraudulent" | "requested_by_customer">("requested_by_customer");
  const [showRefundModal, setShowRefundModal] = useState(false);

  // Revision reply state
  const [replyText, setReplyText] = useState("");
  const [replyEventId, setReplyEventId] = useState<string | null>(null);
  const [replyPending, startReplyTransition] = useTransition();
  const [replySuccess, setReplySuccess] = useState<string | null>(null);

  // Payment actions state (for proof_pending orders)
  const [transferNote, setTransferNote] = useState("");
  const [paymentActionPending, startPaymentTransition] = useTransition();
  const [paymentActionMsg, setPaymentActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [generatedPaymentLink, setGeneratedPaymentLink] = useState<string | null>(null);

  const sc = STATUS_COLORS[detail.order.status] ?? { bg: "#F3F4F6", text: "#6B7280", border: "#E5E7EB" };
  const email =
    detail.order.customerEmail ??
    detail.order.guestEmail ??
    "—";
  const customerName = detail.order.customerName ?? "Client invité";

  function handleChangeStatus() {
    if (!selectedStatus) return;
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await changeOrderStatus({
        orderId: detail.order.id,
        toStatus: selectedStatus,
        note: statusNote || undefined,
        trackingNumber: trackingNumber || undefined,
        trackingCarrier: trackingCarrier || undefined,
      });
      if (res.ok) {
        setSuccessMsg("Statut mis à jour.");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function handleSaveNote() {
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await addInternalNote(detail.order.id, noteText);
      if (res.ok) {
        setSuccessMsg("Note sauvegardée.");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  async function handleUploadProof() {
    if (!proofFile) return;
    setError(null);
    setSuccessMsg(null);
    setUploadProgress(0);

    try {
      // Step 1: Get presigned URL from our API
      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: detail.order.id,
          type: "proof",
          filename: proofFile.name,
          mimeType: proofFile.type || "application/pdf",
        }),
      });

      if (!presignRes.ok) {
        const data = (await presignRes.json()) as { error?: string };
        setError(data.error ?? "Erreur lors de la génération du lien d'upload");
        setUploadProgress(null);
        return;
      }

      const { uploadUrl, key } = (await presignRes.json()) as { uploadUrl: string; key: string };

      // Step 2: Upload directly to MinIO
      setUploadProgress(30);
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: proofFile,
        headers: { "Content-Type": proofFile.type || "application/pdf" },
      });

      if (!uploadRes.ok) {
        setError("Échec de l'upload vers le stockage. Vérifiez la connexion MinIO.");
        setUploadProgress(null);
        return;
      }

      setUploadProgress(80);

      // Step 3: Record in DB and notify customer
      startTransition(async () => {
        const res = await uploadProof({
          orderId: detail.order.id,
          storageKey: key,
          filename: proofFile.name,
          mimeType: proofFile.type || "application/pdf",
        });
        if (res.ok) {
          setSuccessMsg("BAT uploadé sur MinIO et client notifié par email.");
          setProofFile(null);
          setUploadProgress(null);
          router.refresh();
        } else {
          setError(res.error);
          setUploadProgress(null);
        }
      });
    } catch (err) {
      console.error("[upload-proof]", err);
      setError("Erreur inattendue lors de l'upload.");
      setUploadProgress(null);
    }
  }

  function handleRefund() {
    setError(null);
    setSuccessMsg(null);
    const amountCents = refundAmount ? Math.round(parseFloat(refundAmount) * 100) : undefined;
    startTransition(async () => {
      const res = await refundOrder({
        orderId: detail.order.id,
        amountCents,
        reason: refundReason,
      });
      if (res.ok) {
        setSuccessMsg(`Remboursement effectué : ${euros(res.data.amountCents)}`);
        setShowRefundModal(false);
        setRefundAmount("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function handleMarkPaidByTransfer() {
    setPaymentActionMsg(null);
    startPaymentTransition(async () => {
      const res = await markPaidByTransfer(detail.order.id, transferNote || undefined);
      if (res.ok) {
        setPaymentActionMsg({ type: "success", text: "Commande marquée comme payée par virement. Email de confirmation envoyé." });
        router.refresh();
      } else {
        setPaymentActionMsg({ type: "error", text: res.error });
      }
    });
  }

  function handleSendPaymentLink() {
    setPaymentActionMsg(null);
    startPaymentTransition(async () => {
      const res = await sendAdminPaymentLink(detail.order.id);
      if (res.ok) {
        setGeneratedPaymentLink(res.data.checkoutUrl);
        setPaymentActionMsg({ type: "success", text: `Lien de paiement envoyé à ${res.data.email}` });
        router.refresh();
      } else {
        setPaymentActionMsg({ type: "error", text: res.error });
      }
    });
  }

  const canUploadProof = ["paid", "proof_sent", "proof_revision_requested"].includes(detail.order.status);
  const canRefund = !!detail.order.stripePaymentIntentId && !["cancelled", "draft"].includes(detail.order.status);

  const showShipping = selectedStatus === "shipped";

  return (
    <main style={{ padding: "32px 40px" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 20, fontSize: 13, color: "#9CA3AF" }}>
        <Link href="/admin/orders" style={{ color: "#6B7280", textDecoration: "underline" }}>
          Commandes
        </Link>
        {" / "}
        <span style={{ fontFamily: "monospace" }}>
          #{detail.order.id.slice(0, 8).toUpperCase()}
        </span>
      </div>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 32,
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-archivo), system-ui, sans-serif",
              fontSize: 24,
              fontWeight: 900,
              color: "#0A0E27",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Commande #{detail.order.id.slice(0, 8).toUpperCase()}
          </h1>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                padding: "4px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                background: sc.bg,
                color: sc.text,
                border: `1px solid ${sc.border}`,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {STATUS_LABELS[detail.order.status] ?? detail.order.status}
            </span>
            <span style={{ fontSize: 13, color: "#6B7280" }}>
              {formatDate(detail.order.createdAt)}
            </span>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#0A0E27", fontFamily: "var(--font-archivo), monospace" }}>
            {euros(detail.order.totalCents)}
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
            dont {euros(detail.order.shippingCents)} de livraison
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>
        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Customer */}
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>👤 Client</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <InfoRow label="Nom" value={customerName} />
              <InfoRow label="Email" value={email} />
              {detail.order.guestEmail && detail.order.customerEmail && (
                <InfoRow label="Email invité" value={detail.order.guestEmail} />
              )}
            </div>
          </section>

          {/* Addresses + delivery */}
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>🚚 Livraison & Facturation</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {/* Shipping */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  Adresse de livraison
                </div>
                {detail.shippingAddress ? (
                  <AddressBlock address={detail.shippingAddress} />
                ) : (
                  <span style={{ fontSize: 13, color: "#9CA3AF" }}>Non renseignée</span>
                )}
                {detail.order.deliveryMethod && (
                  <div style={{ marginTop: 10, padding: "6px 10px", background: detail.order.deliveryMethod === "express" ? "#FEF3C7" : "#EFF6FF", borderRadius: 6, fontSize: 12, fontWeight: 600, color: detail.order.deliveryMethod === "express" ? "#92400E" : "#1E40AF", display: "inline-block" }}>
                    {detail.order.deliveryMethod === "express" ? "⚡ Chronopost Express" : "📦 Colissimo Standard"}
                  </div>
                )}
              </div>

              {/* Billing */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  Adresse de facturation
                </div>
                {detail.billingAddress ? (
                  <AddressBlock address={detail.billingAddress} />
                ) : detail.shippingAddress ? (
                  <div>
                    <AddressBlock address={detail.shippingAddress} />
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>(identique à la livraison)</div>
                  </div>
                ) : (
                  <span style={{ fontSize: 13, color: "#9CA3AF" }}>Non renseignée</span>
                )}
              </div>
            </div>
          </section>

          {/* Items */}
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>🏷️ Articles ({detail.items.length})</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {detail.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "#F9FAFB",
                    borderRadius: 8,
                    border: "1px solid #E5E7EB",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#0A0E27" }}>
                      {item.quantity}× sticker {item.shape}
                    </div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                      {item.widthMm}mm × {item.heightMm}mm · finition {item.finish}
                    </div>
                    {item.customizationNote && (
                      <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2, fontStyle: "italic" }}>
                        {item.customizationNote}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, fontFamily: "monospace", color: "#0A0E27" }}>
                      {euros(item.lineTotalCents)}
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                      {euros(item.unitPriceCents)} / u
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Client files */}
          {detail.files.length > 0 && (
            <section style={sectionStyle}>
              <h2 style={sectionTitleStyle}>📁 Fichiers ({detail.files.length})</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {detail.files.map((file) => (
                  <FileRow key={file.id} file={file} orderId={detail.order.id} />
                ))}
              </div>
            </section>
          )}

          {/* Timeline */}
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>📋 Historique</h2>
            {detail.events.length === 0 ? (
              <p style={{ color: "#9CA3AF", fontSize: 13 }}>Aucun événement enregistré.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {detail.events.map((ev, i) => {
                  const icon = EVENT_ICONS[ev.type] ?? "·";
                  const payload = ev.payload as Record<string, unknown> | null;
                  return (
                    <div
                      key={ev.id}
                      style={{ display: "flex", gap: 12, paddingBottom: i < detail.events.length - 1 ? 16 : 0 }}
                    >
                      {/* Icon + line */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 32, flexShrink: 0 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: "#F3F4F6",
                            border: "2px solid #E5E7EB",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 14,
                            flexShrink: 0,
                          }}
                        >
                          {icon}
                        </div>
                        {i < detail.events.length - 1 && (
                          <div style={{ width: 2, flex: 1, background: "#E5E7EB", marginTop: 4 }} />
                        )}
                      </div>

                      {/* Content */}
                      <div style={{ paddingTop: 4, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0E27" }}>
                            {EVENT_LABELS[ev.type] ?? ev.type}
                          </span>
                        </div>
                        {/* Refund amount */}
                        {(ev.type === "order.partial_refund" || ev.type === "order.refunded") && typeof payload?.amountCents === "number" && (
                          <div style={{ fontSize: 12, color: "#DC2626", fontWeight: 600, marginBottom: 2 }}>
                            Montant : {(payload.amountCents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                            {typeof payload.reason === "string" && payload.reason && (
                              <span style={{ fontWeight: 400, color: "#6B7280", marginLeft: 6 }}>— {payload.reason}</span>
                            )}
                          </div>
                        )}
                        {ev.type === "payment.refunded" && typeof payload?.amountRefunded === "number" && (
                          <div style={{ fontSize: 12, color: "#DC2626", fontWeight: 600, marginBottom: 2 }}>
                            Montant remboursé : {(payload.amountRefunded / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                          </div>
                        )}
                        {typeof payload?.note === "string" && (
                          <div style={{ fontSize: 12, color: "#6B7280", fontStyle: "italic" }}>
                            &ldquo;{payload.note}&rdquo;
                          </div>
                        )}
                        {/* Revision message from customer */}
                        {ev.type === "proof.revision_requested" && typeof payload?.message === "string" && (
                          <div style={{ marginTop: 6, padding: "8px 12px", background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 6 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", marginBottom: 2 }}>Message du client :</div>
                            <div style={{ fontSize: 12, color: "#78350F", whiteSpace: "pre-wrap" }}>{payload.message}</div>
                          </div>
                        )}
                        {/* Reply button on revision */}
                        {ev.type === "proof.revision_requested" && (
                          <div style={{ marginTop: 6 }}>
                            {replyEventId === ev.id ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <textarea
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  placeholder="Votre réponse au client…"
                                  rows={3}
                                  style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid #D1D5DB", borderRadius: 6, resize: "vertical", fontFamily: "inherit" }}
                                />
                                {replySuccess && (
                                  <div style={{ fontSize: 12, color: "#065F46", background: "#D1FAE5", padding: "4px 8px", borderRadius: 4 }}>{replySuccess}</div>
                                )}
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    disabled={replyPending || !replyText.trim()}
                                    onClick={() => {
                                      setReplySuccess(null);
                                      startReplyTransition(async () => {
                                        const res = await replyToRevision(detail.order.id, replyText);
                                        if (res.ok) {
                                          setReplySuccess("Réponse envoyée au client.");
                                          setReplyText("");
                                          setReplyEventId(null);
                                          router.refresh();
                                        } else {
                                          setError(res.error);
                                        }
                                      });
                                    }}
                                    style={{ padding: "6px 14px", fontSize: 12, fontWeight: 700, background: "#0A0E27", color: "#fff", border: "none", borderRadius: 6, cursor: replyPending || !replyText.trim() ? "not-allowed" : "pointer", opacity: replyPending || !replyText.trim() ? 0.5 : 1 }}
                                  >
                                    {replyPending ? "Envoi…" : "Envoyer la réponse"}
                                  </button>
                                  <button
                                    onClick={() => { setReplyEventId(null); setReplyText(""); }}
                                    style={{ padding: "6px 10px", fontSize: 12, background: "none", border: "1px solid #D1D5DB", borderRadius: 6, cursor: "pointer", color: "#6B7280" }}
                                  >
                                    Annuler
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setReplyEventId(ev.id)}
                                style={{ padding: "4px 10px", fontSize: 12, fontWeight: 600, background: "#EDE9FE", color: "#5B21B6", border: "1px solid #C4B5FD", borderRadius: 6, cursor: "pointer" }}
                              >
                                💬 Répondre au client
                              </button>
                            )}
                          </div>
                        )}
                        {/* Admin revision reply */}
                        {ev.type === "admin.revision_reply" && typeof payload?.reply === "string" && (
                          <div style={{ marginTop: 4, padding: "6px 10px", background: "#EDE9FE", border: "1px solid #C4B5FD", borderRadius: 6 }}>
                            <div style={{ fontSize: 12, color: "#5B21B6", whiteSpace: "pre-wrap" }}>{payload.reply}</div>
                          </div>
                        )}
                        {/* Pennylane error detail */}
                        {ev.type === "pennylane.error" && (
                          <div style={{ marginTop: 4, padding: "6px 10px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 6 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#991B1B" }}>
                              Étape : {typeof payload?.step === "string" ? payload.step : "—"}
                            </div>
                            <div style={{ fontSize: 11, color: "#7F1D1D", marginTop: 2, wordBreak: "break-all", fontFamily: "monospace" }}>
                              {typeof payload?.error === "string" ? payload.error : JSON.stringify(payload?.error)}
                            </div>
                          </div>
                        )}
                        {typeof payload?.trackingNumber === "string" && (
                          <div style={{ fontSize: 12, color: "#6B7280" }}>
                            Suivi : {typeof payload.trackingCarrier === "string" ? payload.trackingCarrier : ""} {payload.trackingNumber}
                          </div>
                        )}
                        {/* SendCloud status detail */}
                        {ev.type.startsWith("sendcloud.") && typeof payload?.label === "string" && (
                          <div style={{ fontSize: 12, color: "#374151", marginTop: 2 }}>
                            {payload.label}
                            {typeof payload.trackingNumber === "string" && payload.trackingNumber && (
                              <span style={{ marginLeft: 6, color: "#9CA3AF" }}>— {String(payload.trackingNumber)}</span>
                            )}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                          {formatDate(ev.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT — Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Payment actions — visible only when waiting for payment */}
          {detail.order.status === "proof_pending" && (
            <section style={{ ...sectionStyle, border: "1px solid #FCD34D", background: "#FFFBEB" }}>
              <h2 style={{ ...sectionTitleStyle, color: "#92400E" }}>💳 Actions de paiement</h2>

              {paymentActionMsg && (
                <div style={{
                  background: paymentActionMsg.type === "success" ? "#D1FAE5" : "#FEE2E2",
                  border: `1px solid ${paymentActionMsg.type === "success" ? "#6EE7B7" : "#FCA5A5"}`,
                  borderRadius: 6,
                  padding: "8px 12px",
                  fontSize: 13,
                  color: paymentActionMsg.type === "success" ? "#065F46" : "#991B1B",
                  marginBottom: 12,
                }}>
                  {paymentActionMsg.text}
                </div>
              )}

              {generatedPaymentLink && (
                <div style={{ marginBottom: 12, padding: "10px 12px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1D4ED8", marginBottom: 4 }}>Lien de paiement généré :</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      readOnly
                      value={generatedPaymentLink}
                      style={{ flex: 1, fontSize: 11, padding: "6px 8px", border: "1px solid #BFDBFE", borderRadius: 6, background: "#fff", color: "#1E40AF", fontFamily: "monospace" }}
                    />
                    <button
                      onClick={() => { void navigator.clipboard.writeText(generatedPaymentLink); }}
                      style={{ padding: "6px 10px", background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, flexShrink: 0 }}
                    >
                      Copier
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Option 1: Bank transfer */}
                <div style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0A0E27", marginBottom: 8 }}>
                    🏦 Virement bancaire
                  </div>
                  <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 10px 0" }}>
                    Marque la commande comme payée, génère la facture Pennylane et envoie un email de confirmation au client.
                  </p>
                  <input
                    type="text"
                    placeholder="Référence virement (optionnel)"
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    style={{ ...inputStyle, marginBottom: 8, fontSize: 12 }}
                  />
                  <button
                    onClick={handleMarkPaidByTransfer}
                    disabled={paymentActionPending}
                    style={{
                      width: "100%",
                      padding: "9px 14px",
                      borderRadius: 8,
                      border: "none",
                      background: paymentActionPending ? "#6B7280" : "#059669",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: paymentActionPending ? "not-allowed" : "pointer",
                    }}
                  >
                    {paymentActionPending ? "En cours…" : "✓ Marquer payé par virement"}
                  </button>
                </div>

                {/* Option 2: Stripe payment link */}
                <div style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0A0E27", marginBottom: 8 }}>
                    🔗 Lien de paiement Stripe
                  </div>
                  <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 10px 0" }}>
                    Génère un lien Stripe Checkout et l'envoie par email au client. La facture Pennylane sera créée automatiquement dès paiement.
                  </p>
                  <button
                    onClick={handleSendPaymentLink}
                    disabled={paymentActionPending}
                    style={{
                      width: "100%",
                      padding: "9px 14px",
                      borderRadius: 8,
                      border: "none",
                      background: paymentActionPending ? "#6B7280" : "#6366F1",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: paymentActionPending ? "not-allowed" : "pointer",
                    }}
                  >
                    {paymentActionPending ? "En cours…" : "📧 Envoyer le lien de paiement"}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Status change */}
          {detail.nextStatuses.length > 0 && (
            <section style={sectionStyle}>
              <h2 style={sectionTitleStyle}>🔄 Changer le statut</h2>

              {error && (
                <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#991B1B", marginBottom: 12 }}>
                  {error}
                </div>
              )}
              {successMsg && (
                <div style={{ background: "#D1FAE5", border: "1px solid #6EE7B7", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#065F46", marginBottom: 12 }}>
                  {successMsg}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {detail.nextStatuses.map((st) => (
                  <button
                    key={st}
                    onClick={() => setSelectedStatus(selectedStatus === st ? "" : st)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: `2px solid ${selectedStatus === st ? "#0A0E27" : "#E5E7EB"}`,
                      background: selectedStatus === st ? "#0A0E27" : "#F9FAFB",
                      color: selectedStatus === st ? "#fff" : "#374151",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s",
                    }}
                  >
                    {STATUS_NEXT_LABELS[st] ?? `→ ${STATUS_LABELS[st] ?? st}`}
                  </button>
                ))}
              </div>

              {selectedStatus && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {showShipping && (
                    <>
                      <input
                        type="text"
                        placeholder="N° de suivi"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        style={inputStyle}
                      />
                      <input
                        type="text"
                        placeholder="Transporteur (ex: Colissimo)"
                        value={trackingCarrier}
                        onChange={(e) => setTrackingCarrier(e.target.value)}
                        style={inputStyle}
                      />
                    </>
                  )}
                  <textarea
                    placeholder="Note (optionnel)"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    rows={2}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                  <button
                    onClick={handleChangeStatus}
                    disabled={isPending}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 8,
                      border: "none",
                      background: "#DC2626",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: isPending ? "not-allowed" : "pointer",
                      opacity: isPending ? 0.7 : 1,
                    }}
                  >
                    {isPending ? "En cours…" : `Confirmer → ${STATUS_LABELS[selectedStatus] ?? selectedStatus}`}
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Tracking existing */}
          {detail.order.trackingNumber && (
            <section style={sectionStyle}>
              <h2 style={sectionTitleStyle}>🚚 Suivi</h2>
              <InfoRow label="Transporteur" value={detail.order.trackingCarrier ?? "—"} />
              <InfoRow label="N° de suivi" value={detail.order.trackingNumber} />
            </section>
          )}

          {/* SendCloud shipment */}
          <ShipmentSection
            orderId={detail.order.id}
            sendcloudParcelId={detail.order.sendcloudParcelId ?? null}
            shippingLabelUrl={detail.order.shippingLabelUrl ?? null}
            trackingNumber={detail.order.trackingNumber ?? null}
            trackingCarrier={detail.order.trackingCarrier ?? null}
          />

          {/* Upload BAT */}
          {canUploadProof && (
            <section style={{ ...sectionStyle, border: "2px solid #93C5FD", background: "#EFF6FF" }}>
              <h2 style={{ ...sectionTitleStyle, color: "#1E40AF" }}>🖼️ Envoyer un BAT au client</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Drop zone */}
                <label
                  htmlFor="proof-file-input"
                  style={{
                    display: "block",
                    border: `2px dashed ${proofFile ? "#1E40AF" : "#93C5FD"}`,
                    borderRadius: 10,
                    padding: "20px 16px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: proofFile ? "#DBEAFE" : "#fff",
                    transition: "background 0.15s",
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) setProofFile(file);
                  }}
                >
                  <input
                    id="proof-file-input"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.svg,.ai,.eps"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setProofFile(file);
                    }}
                  />
                  {proofFile ? (
                    <div>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>📄</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1E40AF" }}>{proofFile.name}</div>
                      <div style={{ fontSize: 11, color: "#6B7280" }}>
                        {(proofFile.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>⬆️</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                        Glisser-déposer ou cliquer pour choisir le fichier BAT
                      </div>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                        PDF, PNG, JPG, SVG, AI/EPS — max 50 MB
                      </div>
                    </div>
                  )}
                </label>

                {/* Progress bar */}
                {uploadProgress !== null && (
                  <div style={{ background: "#E5E7EB", borderRadius: 999, height: 6, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        background: "#1E40AF",
                        borderRadius: 999,
                        width: `${uploadProgress}%`,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => void handleUploadProof()}
                    disabled={isPending || !proofFile || uploadProgress !== null}
                    style={{
                      flex: 1,
                      padding: "10px 16px",
                      borderRadius: 8,
                      border: "none",
                      background: "#1E40AF",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: isPending || !proofFile || uploadProgress !== null ? "not-allowed" : "pointer",
                      opacity: !proofFile ? 0.6 : 1,
                    }}
                  >
                    {uploadProgress !== null ? `Upload… ${uploadProgress}%` : isPending ? "Enregistrement…" : "Envoyer le BAT →"}
                  </button>
                  {proofFile && uploadProgress === null && (
                    <button
                      onClick={() => setProofFile(null)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid #E5E7EB",
                        background: "#fff",
                        color: "#6B7280",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Internal note */}
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>📝 Note interne</h2>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
              placeholder="Note visible uniquement par l'équipe…"
              style={{ ...inputStyle, resize: "vertical", width: "100%", boxSizing: "border-box" }}
            />
            <button
              onClick={handleSaveNote}
              disabled={isPending}
              style={{
                marginTop: 8,
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#0A0E27",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.7 : 1,
                width: "100%",
              }}
            >
              {isPending ? "Sauvegarde…" : "Sauvegarder la note"}
            </button>
          </section>

          {/* Invoice */}
          {detail.order.pennylaneInvoiceUrl ? (
            <section style={{ ...sectionStyle, border: "1px solid #A7F3D0", background: "#ECFDF5" }}>
              <h2 style={{ ...sectionTitleStyle, color: "#065F46" }}>🧾 Facture</h2>
              <a
                href={detail.order.pennylaneInvoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
                  background: "#065F46", color: "#fff", borderRadius: 8, textDecoration: "none",
                  fontSize: 13, fontWeight: 700,
                }}
              >
                📄 Télécharger la facture Pennylane
              </a>
            </section>
          ) : detail.order.pennylaneInvoiceId ? (
            <RefreshInvoiceButton orderId={detail.order.id} pennylaneInvoiceId={detail.order.pennylaneInvoiceId} />
          ) : (
            <GenerateInvoiceButton orderId={detail.order.id} />
          )}

          {/* Refund */}
          {canRefund && (
            <section style={{ ...sectionStyle, border: "1px solid #FCA5A5", background: "#FEF2F2" }}>
              <h2 style={{ ...sectionTitleStyle, color: "#991B1B" }}>💸 Remboursement</h2>
              {!showRefundModal ? (
                <button
                  onClick={() => setShowRefundModal(true)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "2px solid #DC2626", background: "#fff", color: "#DC2626", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  Rembourser cette commande
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" }}>
                      Montant (laisser vide pour remboursement total)
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={(detail.order.totalCents / 100).toFixed(2)}
                        placeholder={`Max ${(detail.order.totalCents / 100).toFixed(2)} €`}
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <span style={{ fontSize: 13, color: "#6B7280" }}>€</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" }}>
                      Motif
                    </label>
                    <select
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value as typeof refundReason)}
                      style={inputStyle}
                    >
                      <option value="requested_by_customer">Demande du client</option>
                      <option value="duplicate">Commande dupliquée</option>
                      <option value="fraudulent">Frauduleux</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={handleRefund}
                      disabled={isPending}
                      style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontSize: 13, fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}
                    >
                      {isPending ? "En cours…" : "Confirmer le remboursement"}
                    </button>
                    <button
                      onClick={() => setShowRefundModal(false)}
                      style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", color: "#6B7280", fontSize: 12, cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Order IDs */}
          <section style={{ ...sectionStyle, background: "#F9FAFB" }}>
            <h2 style={{ ...sectionTitleStyle, fontSize: 11 }}>INFOS TECHNIQUES</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <InfoRow label="ID commande" value={detail.order.id} mono />
              <InfoRow label="VAT" value={`${Number(detail.order.vatRate) * 100}%`} />
              {detail.order.stripePaymentIntentId && (
                <InfoRow label="Stripe PI" value={detail.order.stripePaymentIntentId} mono />
              )}
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #E5E7EB" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Détail prix</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Sous-total HT</span><span>{euros(detail.order.subtotalCents)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>TVA</span><span>{euros(detail.order.taxAmountCents)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Livraison</span><span>{euros(detail.order.shippingCents)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#0A0E27", marginTop: 4 }}><span>Total TTC</span><span>{euros(detail.order.totalCents)}</span></div>
                  {(() => {
                    // Sum partial refunds from order events
                    const partialRefundTotal = detail.events
                      .filter((e) => e.type === "order.partial_refund")
                      .reduce((acc, e) => {
                        const p = e.payload as Record<string, unknown> | null;
                        return acc + (typeof p?.amountCents === "number" ? p.amountCents : 0);
                      }, 0);
                    const isFullRefund = detail.events.some(
                      (e) => e.type === "order.cancelled" && (e.payload as Record<string, unknown> | null)?.reason === "refund",
                    );
                    const totalRefunded = isFullRefund ? detail.order.totalCents : partialRefundTotal;
                    if (totalRefunded === 0) return null;
                    return (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#DC2626", fontWeight: 600, marginTop: 4, paddingTop: 4, borderTop: "1px dashed #FCA5A5" }}>
                          <span>Remboursé</span>
                          <span>− {euros(totalRefunded)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#0A0E27", marginTop: 2 }}>
                          <span>Net encaissé</span>
                          <span>{euros(Math.max(0, detail.order.totalCents - totalRefunded))}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function AddressBlock({ address }: { address: { line1: string; line2: string | null; postalCode: string; city: string; countryCode: string; phone: string | null } }) {
  return (
    <div style={{ fontSize: 13, color: "#0A0E27", lineHeight: 1.6 }}>
      <div>{address.line1}</div>
      {address.line2 && <div>{address.line2}</div>}
      <div>{address.postalCode} {address.city}</div>
      <div style={{ color: "#6B7280" }}>{address.countryCode}</div>
      {address.phone && <div style={{ color: "#6B7280" }}>📞 {address.phone}</div>}
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "#0A0E27",
          fontFamily: mono ? "monospace" : "inherit",
          wordBreak: "break-all",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #E5E7EB",
  borderRadius: 12,
  padding: "20px 24px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-archivo), system-ui, sans-serif",
  fontSize: 14,
  fontWeight: 800,
  color: "#0A0E27",
  margin: "0 0 16px 0",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #D1D5DB",
  fontSize: 13,
  color: "#0A0E27",
  background: "#fff",
  outline: "none",
  fontFamily: "inherit",
  width: "100%",
  boxSizing: "border-box",
};
