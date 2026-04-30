"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ReviewRequestPageData } from "@/lib/reviews/review-types";

type Step = "stars" | "details" | "photos" | "store" | "confirm";

interface ReviewDraft {
  productId?: string;
  orderItemId?: string;
  rating: number;
  title: string;
  body: string;
  displayName: string;
  mediaKeys: string[];
}

interface StoreReviewDraft {
  rating: number;
  title: string;
  body: string;
}

export default function ReviewRequestClient({ token }: { token: string }) {
  const router = useRouter();
  const [data, setData] = useState<ReviewRequestPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("stars");
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [drafts, setDrafts] = useState<ReviewDraft[]>([]);
  const [storeDraft, setStoreDraft] = useState<StoreReviewDraft>({ rating: 5, title: "", body: "" });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/reviews/request/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
        } else {
          setData(d);
          setDrafts(
            d.items.map((item: ReviewRequestPageData["items"][number]) => ({
              productId: item.productId ?? undefined,
              orderItemId: item.orderItemId ?? undefined,
              rating: 5,
              title: "",
              body: "",
              displayName: "",
              mediaKeys: [],
            })),
          );
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Impossible de charger le formulaire.");
        setLoading(false);
      });
  }, [token]);

  if (loading) return <div className="text-center py-16 text-gray-500">Chargement…</div>;
  if (error) return <div className="text-center py-16 text-red-600">{error}</div>;
  if (!data) return null;

  const items = data.items;
  const currentItem = items[currentItemIndex];

  function updateDraft(index: number, patch: Partial<ReviewDraft>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  async function handlePhotoUpload(index: number, file: File) {
    setUploading(true);
    try {
      const res = await fetch("/api/reviews/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      const { presignedUrl, key } = await res.json();
      await fetch(presignedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      updateDraft(index, { mediaKeys: [...(drafts[index]?.mediaKeys ?? []), key] });
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const payload = [
        ...drafts.map((d) => ({
          type: "product" as const,
          productId: d.productId,
          orderItemId: d.orderItemId,
          rating: d.rating,
          title: d.title || undefined,
          body: d.body || undefined,
          displayName: d.displayName || undefined,
          mediaKeys: d.mediaKeys.length > 0 ? d.mediaKeys : undefined,
        })),
        ...(storeDraft.rating > 0
          ? [
              {
                type: "store" as const,
                rating: storeDraft.rating,
                title: storeDraft.title || undefined,
                body: storeDraft.body || undefined,
              },
            ]
          : []),
      ];

      const res = await fetch(`/api/reviews/request/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.ok) {
        router.push("/reviews/thank-you");
      } else {
        setError(result.error ?? "Erreur lors de la soumission");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gray-900 text-white px-8 py-6">
          <h1 className="text-xl font-semibold">Partagez votre avis</h1>
          <p className="text-gray-300 text-sm mt-1">Votre retour nous aide à nous améliorer</p>
        </div>

        <div className="px-8 py-8">
          {/* Step: Stars */}
          {step === "stars" && (
            <div className="space-y-6">
              <p className="text-gray-600 font-medium">Étape {currentItemIndex + 1} sur {items.length} — Notez votre produit</p>
              {currentItem?.product && (
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                  {currentItem.product.imageUrl && (
                    <Image
                      src={currentItem.product.imageUrl}
                      alt={currentItem.product.name}
                      width={56}
                      height={56}
                      className="rounded-lg object-cover"
                    />
                  )}
                  <span className="font-medium">{currentItem.product.name}</span>
                </div>
              )}
              <StarPicker
                rating={drafts[currentItemIndex]?.rating ?? 5}
                onChange={(r) => updateDraft(currentItemIndex, { rating: r })}
              />
              <button
                className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition"
                onClick={() => setStep("details")}
              >
                Continuer
              </button>
            </div>
          )}

          {/* Step: Details */}
          {step === "details" && (
            <div className="space-y-4">
              <p className="text-gray-600 font-medium">Décrivez votre expérience</p>
              <input
                type="text"
                placeholder="Titre de votre avis"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                value={drafts[currentItemIndex]?.title ?? ""}
                onChange={(e) => updateDraft(currentItemIndex, { title: e.target.value })}
              />
              <textarea
                placeholder="Votre commentaire (facultatif)"
                rows={4}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                value={drafts[currentItemIndex]?.body ?? ""}
                onChange={(e) => updateDraft(currentItemIndex, { body: e.target.value })}
              />
              <input
                type="text"
                placeholder="Votre prénom (affiché publiquement)"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                value={drafts[currentItemIndex]?.displayName ?? ""}
                onChange={(e) => updateDraft(currentItemIndex, { displayName: e.target.value })}
              />
              <div className="flex gap-3">
                <button
                  className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50 transition"
                  onClick={() => setStep("stars")}
                >
                  Retour
                </button>
                <button
                  className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition"
                  onClick={() => setStep("photos")}
                >
                  Continuer
                </button>
              </div>
            </div>
          )}

          {/* Step: Photos */}
          {step === "photos" && (
            <div className="space-y-4">
              <p className="text-gray-600 font-medium">Ajoutez des photos (facultatif)</p>
              <label className="block w-full border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 transition">
                <span className="text-2xl block">📷</span>
                <span className="text-sm text-gray-500 mt-2 block">Cliquez pour ajouter une photo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) await handlePhotoUpload(currentItemIndex, file);
                  }}
                />
              </label>
              {uploading && <p className="text-sm text-gray-500">Upload en cours…</p>}
              {(drafts[currentItemIndex]?.mediaKeys.length ?? 0) > 0 && (
                <p className="text-sm text-green-600">
                  {drafts[currentItemIndex]?.mediaKeys.length} photo(s) ajoutée(s) ✓
                </p>
              )}
              <div className="flex gap-3">
                <button
                  className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50 transition"
                  onClick={() => setStep("details")}
                >
                  Retour
                </button>
                <button
                  className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition"
                  onClick={() => {
                    if (currentItemIndex < items.length - 1) {
                      setCurrentItemIndex((i) => i + 1);
                      setStep("stars");
                    } else {
                      setStep("store");
                    }
                  }}
                >
                  {currentItemIndex < items.length - 1 ? "Produit suivant" : "Continuer"}
                </button>
              </div>
            </div>
          )}

          {/* Step: Store review */}
          {step === "store" && (
            <div className="space-y-4">
              <p className="text-gray-600 font-medium">Comment évaluez-vous notre boutique ? (facultatif)</p>
              <StarPicker
                rating={storeDraft.rating}
                onChange={(r) => setStoreDraft((d) => ({ ...d, rating: r }))}
              />
              <input
                type="text"
                placeholder="Titre de votre avis boutique"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                value={storeDraft.title}
                onChange={(e) => setStoreDraft((d) => ({ ...d, title: e.target.value }))}
              />
              <textarea
                placeholder="Votre commentaire (facultatif)"
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                value={storeDraft.body}
                onChange={(e) => setStoreDraft((d) => ({ ...d, body: e.target.value }))}
              />
              <div className="flex gap-3">
                <button
                  className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50 transition"
                  onClick={() => setStep("photos")}
                >
                  Retour
                </button>
                <button
                  className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition"
                  onClick={() => setStep("confirm")}
                >
                  Continuer
                </button>
              </div>
            </div>
          )}

          {/* Step: Confirm */}
          {step === "confirm" && (
            <div className="space-y-6 text-center">
              <div className="text-5xl">⭐</div>
              <h2 className="text-xl font-semibold">Prêt à soumettre ?</h2>
              <p className="text-gray-500 text-sm">
                Vos {drafts.length} avis produit{drafts.length > 1 ? "s" : ""}
                {storeDraft.rating > 0 ? " et votre avis boutique" : ""} vont être soumis.
              </p>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3">
                <button
                  className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50 transition"
                  onClick={() => setStep("store")}
                  disabled={submitting}
                >
                  Retour
                </button>
                <button
                  className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition disabled:opacity-60"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? "Envoi…" : "Soumettre mes avis"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StarPicker({ rating, onChange }: { rating: number; onChange: (r: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div className="flex gap-2 justify-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(null)}
          className="text-4xl transition-transform hover:scale-110"
          type="button"
        >
          {star <= (hovered ?? rating) ? "⭐" : "☆"}
        </button>
      ))}
    </div>
  );
}
