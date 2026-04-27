# Conformité — Facturation électronique B2B

> Mise à jour : avril 2026
> Réglementation de référence : [Ordonnance n°2021-1190 du 15/09/2021](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000044045359) · [BOI-TVA-DECLA-30-10-30](https://bofip.impots.gouv.fr/bofip/1052-PGP)

---

## 1. Calendrier d'obligation

| Date | Obligation |
|------|-----------|
| **1er septembre 2026** | Toutes les entreprises **reçoivent** les factures électroniques |
| **1er septembre 2026** | PME et micro-entreprises **émettent** des factures électroniques |
| *(déjà en vigueur)* | Grandes entreprises (>5 000 salariés) — émission obligatoire depuis 2024 |

MS Adhésif, en tant que PME/TPE, est concernée par l'obligation d'**émission** à partir du **1er septembre 2026**.

---

## 2. Formats acceptés par l'administration

| Format | Description | Statut dans MS Adhésif |
|--------|-------------|------------------------|
| **Factur-X** (PDF/A-3 + XML XRechnung/UBL) | Format hybride — lecture humaine + traitement automatique | ⚠️ À intégrer (via Pennylane) |
| **UBL 2.1** | XML pur — B2G (marchés publics) | Non requis à ce stade |
| **CII D16B** | Cross Industry Invoice — XML pur | Porté par Factur-X |
| **Chorus Pro** | Portail obligatoire pour les factures au secteur public | Non applicable (B2B uniquement) |

---

## 3. Architecture actuelle — Pennylane

MS Adhésif utilise **Pennylane** comme logiciel de facturation. Pennylane est un **Opérateur de Dématérialisation Partenaire (ODP)** accrédité par la DGFIP.

### Flux actuel

```
Commande payée
     │
     ▼
createAndFinalizeInvoice()   ←── src/lib/pennylane.ts
     │
     ▼
Facture PDF générée sur Pennylane
     │
     ├──▶ URL PDF stockée en base (orders.pennylane_invoice_url)
     │
     └──▶ /account/invoices  ←── téléchargement client
```

### Ce que Pennylane couvre automatiquement (ODP)

- ✅ Génération de Factur-X (PDF/A-3 + XML embarqué)
- ✅ Transmission au PPF (Portail Public de Facturation) ou PDP partenaire
- ✅ Archivage légal 10 ans
- ✅ Mentions obligatoires (SIREN, TVA intracommunautaire, date d'exigibilité…)
- ✅ Numérotation séquentielle sans trou
- ✅ Avoirs (credit notes) avec référence à la facture d'origine

---

## 4. Mentions obligatoires vérifiées

Les factures générées via Pennylane incluent :

| Mention | Champ source |
|---------|-------------|
| Numéro de facture unique et séquentiel | Pennylane auto |
| Date d'émission | Pennylane auto |
| Identité du vendeur (SIREN, adresse, TVA intra) | Paramètres Pennylane |
| Identité de l'acheteur (nom, adresse, SIREN si B2B) | `createCompanyCustomer()` / `createIndividualCustomer()` |
| Désignation des produits/services | Lignes de commande (`line_items`) |
| Quantité · Prix unitaire HT | `line_items[].quantity` · `unit_price_without_vat_in_cents` |
| Taux de TVA applicable | `vat_rate` (calculé par `computeVatRate()` dans `src/lib/vat.ts`) |
| Montant TVA | Calculé par Pennylane |
| Total TTC | Calculé par Pennylane |
| Mention exonération si applicable | `"TVA non applicable — art. 293 B CGI"` ou mention export |
| Conditions de paiement | Paramètre Pennylane (`payment_conditions`) |
| Pénalités de retard | Pied de page Pennylane |

---

## 5. Gestion de la TVA intracommunautaire

### Règles appliquées (`src/lib/vat.ts`)

| Situation | Taux | Mention |
|-----------|------|---------|
| Client France, particulier ou entreprise | 20 % | Standard |
| Client UE, entreprise avec n° TVA valide (VIES) | 0 % | Autoliquidation — `"TVA due par le preneur — art. 283-2 CGI"` |
| Client UE, sans n° TVA valide | 20 % | TVA française appliquée |
| Client hors UE | 0 % | `"Exportation — TVA non applicable"` |

### Validation VIES

- Validation en temps réel via l'API VIES (SOAP)
- Résultat mis en cache PostgreSQL (`vat_validations`) pendant `VIES_CACHE_TTL_HOURS` (défaut 24h)
- En cas d'indisponibilité VIES : fallback conservateur → TVA appliquée (20 %)

---

## 6. Avoirs (remboursements)

Flux actuel dans `src/lib/admin-actions.ts` → `refundOrder()` :

1. Remboursement Stripe via `stripe.refunds.create()`
2. Création d'un avoir Pennylane via `createCreditNote()` — référence la facture originale
3. Statut de commande mis à jour en `"refunded"`
4. Email automatique au client (template `payment-received` avec mention avoir)

---

## 7. Archivage et conservation

- **Durée légale** : 10 ans (art. L.123-22 Code de commerce)
- Pennylane archive automatiquement toutes les factures finalisées
- Les URLs PDF Pennylane sont stockées en base (`orders.pennylane_invoice_url`) comme référence d'accès
- **Ne pas supprimer** les enregistrements `orders` en base avant 10 ans (désactivation ≠ suppression)

---

## 8. RGPD — Données de facturation

Les données de facturation (nom, adresse, SIREN) sont des données à caractère personnel soumises au RGPD :

- **Base légale** : obligation légale (art. 6.1.c RGPD) — conservation des justificatifs comptables
- **Durée de conservation** : 10 ans (alignée obligation comptable)
- **Droit à l'effacement** : ne peut pas s'appliquer aux données de facturation légalement requises
- **Accès** : `/account/invoices` permet au client de télécharger ses propres factures

---

## 9. Prochaines étapes avant septembre 2026

- [ ] Vérifier que Pennylane est bien configuré en mode ODP (et non simple logiciel de facturation)
- [ ] Activer la transmission automatique au PPF dans les paramètres Pennylane
- [ ] Tester la génération d'un Factur-X sur une facture de test et valider avec `factur-x-validator`
- [ ] Ajouter le SIREN de l'entreprise dans les paramètres Pennylane
- [ ] Configurer les mentions légales pied de page (indice de pénalités de retard, escompte…)
- [ ] Vérifier les paramètres de `payment_conditions` envoyés à l'API Pennylane
