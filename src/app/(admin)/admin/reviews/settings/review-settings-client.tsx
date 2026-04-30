"use client";

import { useState } from "react";
import Link from "next/link";
import { updateReviewSettings } from "@/lib/review-actions";
import type { ReviewSettingsRow } from "@/lib/reviews/review-types";

const DEFAULT_SETTINGS: ReviewSettingsRow = {
  id: 1,
  autoPublish: false,
  autoPublishMinRating: null,
  requestDelayDaysAfterFulfillment: 7,
  requestExpiresAfterDays: 60,
  remindersEnabled: true,
  firstReminderDelayDays: 5,
  secondReminderDelayDays: null,
  maxReminderCount: 2,
  collectStoreReview: true,
  collectProductReviews: true,
  collectMedia: true,
  requireModerationForMedia: true,
  requireModerationForLowRating: true,
  lowRatingThreshold: 3,
  displayReviewerLastName: false,
  displayVerifiedBadge: true,
  updatedAt: new Date(),
};

export default function ReviewSettingsClient({ initial }: { initial: ReviewSettingsRow | null }) {
  const [settings, setSettings] = useState<ReviewSettingsRow>(initial ?? DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof ReviewSettingsRow>(key: K, value: ReviewSettingsRow[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateReviewSettings(settings);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/reviews" className="text-gray-400 hover:text-gray-900">← Avis</Link>
        <h1 className="text-xl font-bold text-gray-900">Paramètres des avis</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        {/* Publication */}
        <section>
          <h2 className="font-semibold text-gray-900 mb-4">Publication</h2>
          <div className="space-y-3">
            <ToggleRow
              label="Publication automatique"
              desc="Publier les avis automatiquement sans modération manuelle"
              value={settings.autoPublish}
              onChange={(v) => update("autoPublish", v)}
            />
            <ToggleRow
              label="Modération requise pour les médias"
              desc="Les avis avec photos/vidéos nécessitent une validation manuelle"
              value={settings.requireModerationForMedia}
              onChange={(v) => update("requireModerationForMedia", v)}
            />
            <ToggleRow
              label="Modération requise pour les notes basses"
              desc="Les avis sous le seuil nécessitent une validation manuelle"
              value={settings.requireModerationForLowRating}
              onChange={(v) => update("requireModerationForLowRating", v)}
            />
            {settings.requireModerationForLowRating && (
              <NumberRow
                label="Seuil de note basse"
                desc="Notes inférieures ou égales à ce seuil passent en modération"
                value={settings.lowRatingThreshold}
                min={1}
                max={5}
                onChange={(v) => update("lowRatingThreshold", v)}
              />
            )}
          </div>
        </section>

        {/* Demandes d'avis */}
        <section className="border-t border-gray-100 pt-6">
          <h2 className="font-semibold text-gray-900 mb-4">Demandes d&apos;avis</h2>
          <div className="space-y-3">
            <NumberRow
              label="Délai avant envoi (jours)"
              desc="Nombre de jours après la livraison avant l'envoi de l'email"
              value={settings.requestDelayDaysAfterFulfillment}
              min={0}
              max={90}
              onChange={(v) => update("requestDelayDaysAfterFulfillment", v)}
            />
            <NumberRow
              label="Expiration du lien (jours)"
              desc="Le lien d'avis expire après ce nombre de jours"
              value={settings.requestExpiresAfterDays}
              min={7}
              max={365}
              onChange={(v) => update("requestExpiresAfterDays", v)}
            />
            <ToggleRow
              label="Relances activées"
              value={settings.remindersEnabled}
              onChange={(v) => update("remindersEnabled", v)}
            />
            {settings.remindersEnabled && (
              <>
                <NumberRow
                  label="Délai avant 1ère relance (jours)"
                  value={settings.firstReminderDelayDays}
                  min={1}
                  max={30}
                  onChange={(v) => update("firstReminderDelayDays", v)}
                />
                <NumberRow
                  label="Nombre maximum de relances"
                  value={settings.maxReminderCount}
                  min={1}
                  max={5}
                  onChange={(v) => update("maxReminderCount", v)}
                />
              </>
            )}
          </div>
        </section>

        {/* Collecte */}
        <section className="border-t border-gray-100 pt-6">
          <h2 className="font-semibold text-gray-900 mb-4">Collecte</h2>
          <div className="space-y-3">
            <ToggleRow
              label="Collecter des avis produit"
              value={settings.collectProductReviews}
              onChange={(v) => update("collectProductReviews", v)}
            />
            <ToggleRow
              label="Collecter des avis boutique"
              value={settings.collectStoreReview}
              onChange={(v) => update("collectStoreReview", v)}
            />
            <ToggleRow
              label="Autoriser les photos/vidéos"
              value={settings.collectMedia}
              onChange={(v) => update("collectMedia", v)}
            />
          </div>
        </section>

        {/* Affichage */}
        <section className="border-t border-gray-100 pt-6">
          <h2 className="font-semibold text-gray-900 mb-4">Affichage</h2>
          <div className="space-y-3">
            <ToggleRow
              label="Afficher le badge vérifié"
              value={settings.displayVerifiedBadge}
              onChange={(v) => update("displayVerifiedBadge", v)}
            />
            <ToggleRow
              label="Afficher le nom de famille"
              desc="Affiche le nom complet au lieu des initiales"
              value={settings.displayReviewerLastName}
              onChange={(v) => update("displayReviewerLastName", v)}
            />
          </div>
        </section>

        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          {saved && <span className="text-green-600 text-sm">Enregistré ✓</span>}
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${value ? "bg-gray-900" : "bg-gray-200"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${value ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

function NumberRow({ label, desc, value, min, max, onChange }: { label: string; desc?: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
      </div>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-center"
      />
    </div>
  );
}
