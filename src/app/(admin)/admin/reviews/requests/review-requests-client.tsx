"use client";

import { useState } from "react";
import Link from "next/link";
import { createManualReviewRequest } from "@/lib/review-actions";
import type { ReviewRequestRow, ReviewRequestStatus } from "@/lib/reviews/review-types";

interface Props {
  initial: { requests: ReviewRequestRow[]; total: number; page: number; limit: number };
}

const STATUS_COLORS: Record<ReviewRequestStatus, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  sent: "bg-purple-100 text-purple-700",
  opened: "bg-indigo-100 text-indigo-700",
  clicked: "bg-yellow-100 text-yellow-700",
  submitted: "bg-green-100 text-green-700",
  expired: "bg-gray-100 text-gray-500",
  cancelled: "bg-red-100 text-red-600",
};

export default function ReviewRequestsClient({ initial }: Props) {
  const [requests, setRequests] = useState(initial.requests);
  const [total, setTotal] = useState(initial.total);
  const [page, setPage] = useState(initial.page);
  const [orderId, setOrderId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");

  async function handleCreateManual() {
    if (!orderId.trim()) return;
    setCreating(true);
    setCreateMsg("");
    try {
      await createManualReviewRequest(orderId.trim());
      setCreateMsg("Demande créée avec succès !");
      setOrderId("");
      // Reload
      const res = await fetch("/api/admin/reviews/requests?limit=20");
      const data = await res.json();
      setRequests(data.requests);
      setTotal(data.total);
    } catch (err) {
      setCreateMsg(err instanceof Error ? err.message : "Erreur");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/reviews" className="text-gray-400 hover:text-gray-900">← Avis</Link>
        <h1 className="text-xl font-bold text-gray-900">Demandes d&apos;avis</h1>
        <span className="text-gray-400 text-sm">({total})</span>
      </div>

      {/* Manual create */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <h2 className="font-medium text-gray-900 mb-3">Créer une demande manuellement</h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="ID de commande (UUID)"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          />
          <button
            onClick={handleCreateManual}
            disabled={creating || !orderId.trim()}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {creating ? "Création…" : "Créer"}
          </button>
        </div>
        {createMsg && <p className="text-sm mt-2 text-gray-600">{createMsg}</p>}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {requests.length === 0 ? (
          <div className="py-12 text-center text-gray-400">Aucune demande</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Email</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Statut</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Envoi prévu</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Expiration</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Relances</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map((req) => (
                <tr key={req.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{req.customerEmail}</p>
                    {req.orderId && <p className="text-gray-400 text-xs">Cmd: {req.orderId.slice(0, 8).toUpperCase()}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[req.status]}`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(req.sendAt).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(req.expiresAt).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3 text-gray-500">{req.reminderCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
