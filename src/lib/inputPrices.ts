/**
 * What seed, fertiliser and pesticide cost — from the website's live-web layer.
 *
 * The store locator answers "where can I buy urea"; this answers "what will it
 * cost me". The app had neither until now, so a farmer asking about inputs by
 * voice got directions to a shop and no number.
 *
 * Everything that makes this work — the key pool, the search/fetch/agent
 * ladder, the per-site adapters — lives on the server and needs secrets, so
 * the app calls the route rather than duplicating any of it.
 */
import { API_BASE_URL } from "./apiBase";
import { authHeaders } from "./authHeaders";

export const INPUT_CATEGORIES = ["fertiliser", "seed", "pesticide"] as const;
export type InputCategory = (typeof INPUT_CATEGORIES)[number];

export type InputPriceRow = {
  siteId: string;
  siteLabel: string;
  productName: string;
  priceInr: number;
  unit: string;
  url: string;
  /** How the row was obtained. The tiers differ in cost, so it is shown. */
  tier: "search" | "fetch" | "agent";
};

export type InputPriceReport = {
  category: string;
  term: string;
  rows: InputPriceRow[];
  missing: { siteId: string; siteLabel: string; reason: string }[];
  /** Where these numbers came from, shown verbatim rather than summarised. */
  provenance: string;
  checkedAt: string;
};

export type InputPriceOutcome =
  | { ok: true; report: InputPriceReport }
  | { ok: false; error: string };

/**
 * Look up one term in one category.
 *
 * The ladder can take a while — it may fall through to a browser agent — so
 * the timeout is generous. A failure returns the sentence to show rather than
 * throwing: an empty price list with an explanation beats a crash.
 */
export async function lookupInputPrices(
  category: InputCategory,
  term: string
): Promise<InputPriceOutcome> {
  if (!API_BASE_URL) return { ok: false, error: "Input prices aren't configured on this build." };
  const q = term.trim();
  if (!q) return { ok: false, error: "Type what you want the price of." };

  try {
    const res = await fetch(`${API_BASE_URL}/api/input-prices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(await authHeaders()),
      },
      body: JSON.stringify({ category, term: q }),
      signal: AbortSignal.timeout(60000),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: j?.error ?? "That lookup failed. Please try again." };
    return { ok: true, report: j as InputPriceReport };
  } catch (e) {
    const aborted =
      typeof e === "object" && e !== null && /abort|timeout/i.test(String((e as Error).name ?? ""));
    return {
      ok: false,
      error: aborted
        ? "The shops took too long to answer. Try again in a moment."
        : "No connection, so prices could not be checked.",
    };
  }
}
