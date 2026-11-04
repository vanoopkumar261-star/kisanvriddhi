/**
 * Client for the web app's /api/market + /api/market/mandis routes — the
 * mobile equivalent of the web dashboard's server-side lib/market.ts. The
 * real fetch logic (Agmarknet pagination, DATA_GOV_API_KEY) stays on the
 * server; this just calls it over HTTP. See docs/MOBILE_APP_ROADMAP.md.
 */

import { API_BASE_URL } from "./apiBase";
import { authHeaders } from "./authHeaders";

/**
 * Read through apiBase rather than straight from the environment.
 *
 * This file was the one client still reading `EXPO_PUBLIC_API_BASE_URL`
 * itself, so it got the raw `http://localhost:3000` while every other screen
 * got apiBase's resolved host. On a real phone that is the difference between
 * working and not: mandi prices were the feature that failed while the
 * assistant, which goes through apiBase, kept answering.
 */
const BASE_URL = API_BASE_URL;

export type CropMarket = {
  name: string;
  unit: string;
  price: number;
  change: number;
  demand: "High" | "Medium" | "Low";
  series: { d: string; price: number }[];
  isReal: boolean;
  notAvailable?: boolean;
  reportedOn?: string;
  /** True when the price is the national fallback (farmer's state had no arrivals today). */
  national?: boolean;
};

export type MandiRow = {
  mandi: string;
  price: number;
  distanceKm: number | null; // real road distance from the farmer; null if not located
  fees: {
    marketFee: number;
    cess: number;
    commission: number;
    loading: number;
    gunnyBag: number;
    weighing: number;
  };
  totalDeductions: number;
  netPrice: number;
};

export type MarketSnapshot = {
  state: string | null;
  isRealData: boolean;
  crops: CropMarket[];
};

export async function getMarket(houseAddress: string | null): Promise<MarketSnapshot | null> {
  if (!BASE_URL) {
    console.error("MARKET error: no API base URL — see apiBase.ts");
    return null;
  }
  try {
    const url = `${BASE_URL}/api/market?address=${encodeURIComponent(houseAddress ?? "")}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as MarketSnapshot;
  } catch (e) {
    console.error("MARKET error:", e);
    return null;
  }
}

export async function getMandiRows(
  houseAddress: string | null,
  crop: string,
  origin?: { lat: number; lon: number } | null
): Promise<MandiRow[]> {
  if (!BASE_URL) return [];
  try {
    let url = `${BASE_URL}/api/market/mandis?address=${encodeURIComponent(
      houseAddress ?? ""
    )}&crop=${encodeURIComponent(crop)}`;
    // Send the farmer's location so the backend returns real road distances.
    if (origin) url += `&lat=${origin.lat}&lon=${origin.lon}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.mandis ?? []) as MandiRow[];
  } catch (e) {
    console.error("MANDIS error:", e);
    return [];
  }
}

// ── State lookup ──────────────────────────────────────────────────────────────

/**
 * Nominatim writes the state into the middle of a long display_name string, so
 * the state is recovered by matching against the known list rather than by
 * splitting on commas (whose position varies by place). Mirrors STATE_MAP in
 * the web repo's src/lib/market.ts — keep the two in step.
 */
const STATE_MAP: Record<string, string> = {
  "andhra pradesh": "Andhra Pradesh",
  "arunachal pradesh": "Arunachal Pradesh",
  assam: "Assam",
  bihar: "Bihar",
  chhattisgarh: "Chhattisgarh",
  goa: "Goa",
  gujarat: "Gujarat",
  haryana: "Haryana",
  "himachal pradesh": "Himachal Pradesh",
  jharkhand: "Jharkhand",
  karnataka: "Karnataka",
  kerala: "Kerala",
  "madhya pradesh": "Madhya Pradesh",
  maharashtra: "Maharashtra",
  manipur: "Manipur",
  meghalaya: "Meghalaya",
  mizoram: "Mizoram",
  nagaland: "Nagaland",
  odisha: "Odisha",
  punjab: "Punjab",
  rajasthan: "Rajasthan",
  sikkim: "Sikkim",
  "tamil nadu": "Tamil Nadu",
  telangana: "Telangana",
  tripura: "Tripura",
  "uttar pradesh": "Uttar Pradesh",
  uttarakhand: "Uttarakhand",
  "west bengal": "West Bengal",
  delhi: "Delhi",
  "jammu and kashmir": "Jammu and Kashmir",
  ladakh: "Ladakh",
};

/** The Indian state named in a house address, or null. */
export function extractStateFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const lower = address.toLowerCase();
  for (const [key, value] of Object.entries(STATE_MAP)) {
    if (lower.includes(key)) return value;
  }
  return null;
}

/* ───────────────────── sell or hold ─────────────────────────────────────── */

export type MarketAction = "Sell now" | "Hold" | "Wait";

export type MarketRec = {
  crop: string;
  action: MarketAction;
  reason: string;
  /** 0..1. Shown, because a 55% call and a 90% call are not the same advice. */
  confidence: number;
};

export type MarketAdvice = { headline: string; recommendations: MarketRec[] };

/**
 * Should the farmer sell now or hold?
 *
 * The app has shown prices since it shipped and never said what to do with
 * them, which leaves the hardest part of the question — timing — entirely to
 * the farmer. The website has had this; the phone had the numbers alone.
 *
 * Needs the Groq key, so it runs server-side. Returns null rather than
 * throwing: advice is an addition to the price list, never a precondition for
 * showing it.
 */
export async function getMarketAdvice(input: {
  prices: CropMarket[];
  farmerCrops: string[];
  locale: string;
  unavailableCrops?: string[];
  state?: string | null;
}): Promise<MarketAdvice | null> {
  if (!BASE_URL || !input.prices.length) return null;
  try {
    const res = await fetch(`${BASE_URL}/api/market-advice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(await authHeaders()),
      },
      body: JSON.stringify({
        prices: input.prices,
        farmerCrops: input.farmerCrops,
        locale: input.locale,
        unavailableCrops: input.unavailableCrops ?? [],
        state: input.state ?? null,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j?.headline || !Array.isArray(j?.recommendations)) return null;
    return j as MarketAdvice;
  } catch {
    return null;
  }
}
