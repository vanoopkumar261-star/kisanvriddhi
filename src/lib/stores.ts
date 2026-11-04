export type Store = {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  distanceKm: number;
  rating: number;
  source: "osm" | "generated";
};

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

const SHOP_LABEL: Record<string, string> = {
  agrarian: "Agri Supplies",
  farm: "Farm Supplies",
  garden_centre: "Garden Centre",
  hardware: "Hardware Store",
  doityourself: "Hardware Store",
  trade: "Agri Trade",
  chemist: "Agro Chemist",
};

function ratingFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Number((3.8 + (h % 12) / 10).toFixed(1)); // 3.8 – 4.9
}

async function fromOverpass(lat: number, lng: number, radiusM: number): Promise<Store[]> {
  const query = `[out:json][timeout:20];
(
  node["shop"="agrarian"](around:${radiusM},${lat},${lng});
  node["shop"="farm"](around:${radiusM},${lat},${lng});
  node["shop"="garden_centre"](around:${radiusM},${lat},${lng});
  node["shop"="hardware"](around:${radiusM},${lat},${lng});
  node["shop"="doityourself"](around:${radiusM},${lat},${lng});
);
out center 40;`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // Overpass answers 406 to the bare `okhttp/...` agent React Native sends
      // by default, so every store lookup silently fell back to the generated
      // list. Identify the app the way its usage policy asks, as geocode.ts
      // already does for Nominatim.
      "User-Agent": "KisanVriddhi-Mobile/1.0",
    },
    body: "data=" + encodeURIComponent(query),
    // Longer than the query's own [timeout:20] on purpose: aborting first turns
    // a slow-but-successful Overpass run into a bare "canceled" with nothing to
    // report.
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error("overpass " + res.status);
  const data = await res.json();

  const stores: Store[] = (data.elements ?? [])
    .filter((e: any) => e.lat && e.lon && e.tags?.name)
    .map((e: any) => {
      const shop = e.tags.shop as string;
      return {
        id: `osm-${e.id}`,
        name: e.tags.name as string,
        type: SHOP_LABEL[shop] ?? "Farm Supplies",
        lat: e.lat,
        lng: e.lon,
        distanceKm: Number(haversineKm(lat, lng, e.lat, e.lon).toFixed(1)),
        rating: ratingFor(String(e.id)),
        source: "osm" as const,
      };
    })
    .sort((a: Store, b: Store) => a.distanceKm - b.distanceKm)
    .slice(0, 12);

  return stores;
}

/** Plausible fallback for sparse rural areas where OSM has no tagged shops. */
function generated(lat: number, lng: number): Store[] {
  const names = [
    ["Kisan Agro Centre", "Agri Supplies"],
    ["Sri Balaji Fertilizers", "Agri Supplies"],
    ["Green Field Seeds", "Seed Store"],
    ["Annapurna Krishi Kendra", "Farm Supplies"],
    ["Farmer's Choice Agri", "Agri Supplies"],
    ["Mahalaxmi Pesticides", "Agro Chemist"],
  ];
  return names.map(([name, type], i) => {
    const ang = (i / names.length) * Math.PI * 2;
    const dist = 2 + (i % 4) * 3.5; // km
    const dLat = (dist / 111) * Math.cos(ang);
    const dLng = (dist / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(ang);
    const sLat = lat + dLat;
    const sLng = lng + dLng;
    return {
      id: `gen-${i}`,
      name,
      type,
      lat: sLat,
      lng: sLng,
      distanceKm: Number(haversineKm(lat, lng, sLat, sLng).toFixed(1)),
      rating: ratingFor(name),
      source: "generated" as const,
    };
  }).sort((a, b) => a.distanceKm - b.distanceKm);
}

export async function getNearbyStores(lat: number, lng: number): Promise<Store[]> {
  try {
    const osm = await fromOverpass(lat, lng, 25000);
    if (osm.length >= 3) return osm;
    // Merge sparse OSM results with a couple of fallbacks for a fuller list.
    const gen = generated(lat, lng);
    return [...osm, ...gen].slice(0, 8).sort((a, b) => a.distanceKm - b.distanceKm);
  } catch (e) {
    /*
      An abort is not a failure. Overpass is slow enough that leaving the
      screen mid-query is routine — say "where can I buy urea", read the list,
      then say "scan this leaf" — and React Native cancels the in-flight fetch
      on unmount. That surfaced as a red error box on top of whatever screen
      the farmer had just opened, for a request nobody was waiting for any
      more. The fallback below was already the right behaviour; only the shouting
      was wrong.
    */
    if (!isAbort(e)) console.warn("STORES overpass unavailable, using fallback:", e);
    return generated(lat, lng);
  }
}

/** True for a fetch cut short — by our own timeout, or by the screen going away. */
function isAbort(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const name = (e as { name?: unknown }).name;
  const msg = String((e as { message?: unknown }).message ?? "");
  return name === "AbortError" || name === "TimeoutError" || /abort|cancel/i.test(msg);
}
