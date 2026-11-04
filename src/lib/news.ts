import { API_BASE_URL } from "./apiBase";

/**
 * Farmer-tuned news, from the web app's /api/news.
 *
 * That route does the heavy lifting: it tries GNews.io, falls back to
 * NewsAPI.org, and as a last resort has Groq write the summaries — then ranks
 * everything against this farmer's own crops and state and drops anything whose
 * headline isn't actually about agriculture. All this client does is ask and
 * render, so the ranking stays in one place for both apps.
 *
 * `source` is worth surfacing: "ai" means no live provider answered and the
 * articles are model-written, which the UI labels rather than passing off as
 * reporting.
 */

export type NewsArticle = {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
  imageUrl: string | null;
  category: "crop" | "oilseed" | "farming" | "general";
  relevantCrop?: string;
};

export type NewsResponse = {
  articles: NewsArticle[];
  source: "live" | "ai" | "error";
  provider?: string;
};

export type NewsCategory = NewsArticle["category"];

/** Label + hue per category, in the app's palette. */
export const CATEGORY_META: Record<NewsCategory, { label: string; icon: string; color: string }> = {
  crop: { label: "Your crops", icon: "leaf-outline", color: "#1B4332" },
  oilseed: { label: "Oilseeds", icon: "water-outline", color: "#D4A72C" },
  farming: { label: "Agriculture", icon: "trending-up-outline", color: "#3E6FB8" },
  general: { label: "General", icon: "globe-outline", color: "#6B7A70" },
};

export const CATEGORY_ORDER: NewsCategory[] = ["crop", "oilseed", "farming", "general"];

/** "12m ago" / "3h ago" / "2d ago". */
export function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const mins = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export async function getNews(
  farmerCrops: string[],
  state: string | null
): Promise<NewsResponse | null> {
  if (!API_BASE_URL) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/api/news`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ farmerCrops, state }),
      // The provider chain can walk through two upstreams before answering.
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    return (await res.json()) as NewsResponse;
  } catch (e) {
    console.warn("NEWS fetch failed:", e);
    return null;
  }
}
