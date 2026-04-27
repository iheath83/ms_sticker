import { listEmailTemplates, seedEmailTemplates, seedUnlayerDesigns } from "@/lib/email-template-actions";
import { EMAIL_TEMPLATE_TYPES } from "@/db/schema";
import Link from "next/link";
import { DEFAULT_TEMPLATES } from "@/lib/email-defaults";

export const metadata = { title: "Éditeur d'emails — Admin" };

export default async function AdminEmailsPage() {
  // Auto-seed on first visit (inserts rows + Unlayer designs)
  await seedEmailTemplates().catch(() => null);
  await seedUnlayerDesigns().catch(() => null);

  const rows = await listEmailTemplates();

  const byType = new Map(rows.map((r) => [r.type, r]));

  const LABELS: Record<string, string> = {
    "order-received": "Commande reçue",
    "proof-ready": "BAT prêt",
    "proof-revision-acknowledged": "Révision BAT reçue",
    "payment-received": "Paiement confirmé",
    "order-shipped": "Commande expédiée",
    "admin-new-order": "Nouvelle commande (admin)",
    "bat-reply": "Réponse BAT (admin → client)",
  };

  const ICONS: Record<string, string> = {
    "order-received": "✅",
    "proof-ready": "🎨",
    "proof-revision-acknowledged": "🔄",
    "payment-received": "💳",
    "order-shipped": "📦",
    "admin-new-order": "🛒",
    "bat-reply": "📩",
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Éditeur d&apos;emails transactionnels</h1>
        <p className="text-sm text-gray-500 mt-1">
          Personnalisez chaque email envoyé à vos clients. Les variables{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">{"{{variable}}"}</code> sont
          remplacées automatiquement.
        </p>
      </div>

      <div className="grid gap-3">
        {EMAIL_TEMPLATE_TYPES.map((type) => {
          const row = byType.get(type);
          const def = DEFAULT_TEMPLATES.find((t) => t.type === type);
          const isCustomized = !!row?.id;
          return (
            <Link
              key={type}
              href={`/admin/emails/${type}`}
              className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:border-red-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl w-10 text-center">{ICONS[type] ?? "📧"}</span>
                <div>
                  <p className="font-semibold text-gray-900 group-hover:text-red-600 transition-colors">
                    {LABELS[type] ?? type}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">
                    {row?.subject ?? def?.subject ?? "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isCustomized ? (
                  <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-full font-medium">
                    Personnalisé
                  </span>
                ) : (
                  <span className="text-xs px-2 py-1 bg-gray-50 text-gray-400 rounded-full font-medium">
                    Par défaut
                  </span>
                )}
                <span className="text-gray-300 group-hover:text-red-400 transition-colors text-lg">→</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
