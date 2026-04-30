"use client";

import { useState } from "react";
import Link from "next/link";

export default function UnsubscribeClient({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleUnsubscribe() {
    setStatus("loading");
    try {
      const res = await fetch(`/api/reviews/unsubscribe/${token}`, { method: "POST" });
      const data = await res.json();
      setStatus(data.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 max-w-md w-full text-center">
      {status === "success" ? (
        <>
          <div className="text-5xl mb-6">✅</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-3">Désinscription confirmée</h1>
          <p className="text-gray-500 mb-8">
            Vous ne recevrez plus d&apos;emails de demande d&apos;avis de notre part.
          </p>
          <Link href="/" className="text-gray-900 underline text-sm">Retour à la boutique</Link>
        </>
      ) : status === "error" ? (
        <>
          <div className="text-5xl mb-6">❌</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-3">Une erreur est survenue</h1>
          <p className="text-gray-500 mb-8">Veuillez réessayer ou nous contacter.</p>
          <Link href="/" className="text-gray-900 underline text-sm">Retour à la boutique</Link>
        </>
      ) : (
        <>
          <div className="text-5xl mb-6">📧</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-3">Se désabonner des emails d&apos;avis</h1>
          <p className="text-gray-500 mb-8">
            En confirmant, vous ne recevrez plus d&apos;emails vous demandant de laisser un avis sur vos commandes.
          </p>
          <button
            onClick={handleUnsubscribe}
            disabled={status === "loading"}
            className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition disabled:opacity-60"
          >
            {status === "loading" ? "Traitement…" : "Confirmer la désinscription"}
          </button>
          <Link href="/" className="block mt-4 text-gray-500 underline text-sm">Annuler</Link>
        </>
      )}
    </div>
  );
}
