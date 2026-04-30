import type { ShippingZoneDB, ShippingDestination } from "./types";
import { postalCodeMatchesRules } from "./postal-codes";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function destinationMatchesZone(destination: ShippingDestination, zone: ShippingZoneDB): boolean {
  const { country, region, city, postalCode, latitude, longitude } = destination;
  const countryUpper = country.toUpperCase();

  // Country check (mandatory if countries are set)
  if (zone.countries.length > 0) {
    if (!zone.countries.map((c) => c.toUpperCase()).includes(countryUpper)) return false;
  }

  // Geo radius check (if enabled)
  if (zone.geoRadius?.enabled && latitude !== undefined && longitude !== undefined) {
    const dist = haversineKm(zone.geoRadius.originLat, zone.geoRadius.originLng, latitude, longitude);
    if (dist > zone.geoRadius.radiusKm) return false;
  }

  // Region check
  if (zone.regions && zone.regions.length > 0 && region) {
    if (!zone.regions.map((r) => r.toLowerCase()).includes(region.toLowerCase())) return false;
  }

  // City check
  if (zone.cities && zone.cities.length > 0 && city) {
    if (!zone.cities.map((c) => c.toLowerCase()).includes(city.toLowerCase())) return false;
  }

  // Postal code rules
  if (zone.postalRules && zone.postalRules.length > 0 && postalCode) {
    return postalCodeMatchesRules(postalCode, zone.postalRules);
  }

  return true;
}

/**
 * Returns all zone IDs that match the given destination.
 */
export function getMatchingZoneIds(destination: ShippingDestination, zones: ShippingZoneDB[]): string[] {
  return zones.filter((z) => z.isActive && destinationMatchesZone(destination, z)).map((z) => z.id);
}
