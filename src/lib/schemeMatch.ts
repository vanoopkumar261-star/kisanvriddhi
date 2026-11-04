import { API_BASE_URL } from "./apiBase";
import type { Scheme } from "./schemes";

export type SchemeMatchResult = { headline: string; matches: { id: string; why: string }[] } | null;

export async function matchSchemes(
  profile: string,
  schemes: Scheme[],
  locale: string = "en"
): Promise<SchemeMatchResult> {
  if (!API_BASE_URL) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/api/scheme-match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, schemes, locale }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error("SCHEME-MATCH error:", e);
    return null;
  }
}
