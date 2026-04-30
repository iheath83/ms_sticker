import type { ShippingQuoteContext } from "./types";

// ─── External carrier interface ───────────────────────────────────────────────

export type ShippingCarrierRate = {
  methodId: string;
  carrierCode: string;
  serviceName: string;
  publicName: string;
  priceCents: number;
  currency: string;
  minDeliveryDays?: number;
  maxDeliveryDays?: number;
  trackingAvailable: boolean;
};

export interface CarrierRateProvider {
  code: string;
  name: string;
  getRates(context: ShippingQuoteContext): Promise<ShippingCarrierRate[]>;
}

// ─── Colissimo stub ───────────────────────────────────────────────────────────

export class ColissimoProvider implements CarrierRateProvider {
  code = "colissimo";
  name = "Colissimo";

  async getRates(context: ShippingQuoteContext): Promise<ShippingCarrierRate[]> {
    const country = context.destination.country.toUpperCase();
    const weight = context.cart.totalWeight ?? 0;

    // France only for now
    if (country !== "FR") return [];

    const basePrice = weight <= 5 ? 490 : weight <= 10 ? 690 : 990;

    return [
      {
        methodId: "colissimo_home",
        carrierCode: "colissimo",
        serviceName: "Colissimo Domicile",
        publicName: "Colissimo à domicile",
        priceCents: basePrice,
        currency: "EUR",
        minDeliveryDays: 2,
        maxDeliveryDays: 4,
        trackingAvailable: true,
      },
    ];
  }
}

// ─── Chronopost stub ──────────────────────────────────────────────────────────

export class ChronopostProvider implements CarrierRateProvider {
  code = "chronopost";
  name = "Chronopost";

  async getRates(context: ShippingQuoteContext): Promise<ShippingCarrierRate[]> {
    const country = context.destination.country.toUpperCase();
    if (country !== "FR") return [];

    return [
      {
        methodId: "chronopost_express",
        carrierCode: "chronopost",
        serviceName: "Chronopost Express J+1",
        publicName: "Chronopost Express",
        priceCents: 1490,
        currency: "EUR",
        minDeliveryDays: 1,
        maxDeliveryDays: 1,
        trackingAvailable: true,
      },
    ];
  }
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const CARRIER_REGISTRY: CarrierRateProvider[] = [
  new ColissimoProvider(),
  new ChronopostProvider(),
];

export function getCarrierProvider(code: string): CarrierRateProvider | undefined {
  return CARRIER_REGISTRY.find((c) => c.code === code);
}

export function getAllCarrierProviders(): CarrierRateProvider[] {
  return CARRIER_REGISTRY;
}

/**
 * Fetch rates from all registered carrier providers, merged into a flat list.
 * The shipping engine can use this to get carrier rates then apply internal rules on top.
 */
export async function fetchAllCarrierRates(
  context: ShippingQuoteContext,
): Promise<ShippingCarrierRate[]> {
  const results = await Promise.allSettled(
    CARRIER_REGISTRY.map((provider) => provider.getRates(context)),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<ShippingCarrierRate[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
}
