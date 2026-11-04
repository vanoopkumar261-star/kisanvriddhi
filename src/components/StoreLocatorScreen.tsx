import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "./i18n/LanguageProvider";
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/components/ui/Pressable";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDashboardData } from "@/lib/dashboard";
import { getNearbyStores, type Store } from "@/lib/stores";
import { colors } from "@/constants/colors";
import { cardShadow } from "@/constants/effects";
import { SkeletonHeader, SkeletonRow } from "./ui/Skeleton";
import { Reveal } from "./ui/Reveal";

import { themed } from "@/theme";
import { useScreenDescriber } from "@/lib/agent/screenRegistry";
export function StoreLocatorScreen() {
  const { t } = useT();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);

  /*
    Overpass can take 25 seconds, and leaving before it answers is routine —
    the voice agent makes it one sentence to go somewhere else. Every state
    write is therefore guarded: the screen may be gone by the time the network
    comes back.
  */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const dash = await getDashboardData();
    if (!alive.current) return;
    const lat = dash.farmer?.house_lat;
    const lng = dash.farmer?.house_lng;
    if (lat == null || lng == null) {
      setHasLocation(false);
      return;
    }
    setHasLocation(true);
    const found = await getNearbyStores(lat, lng);
    if (alive.current) setStores(found);
  }, []);

  useEffect(() => {
    load().finally(() => {
      if (alive.current) setLoading(false);
    });
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  useScreenDescriber("/stores", () => {
    if (loading) return "";
    if (!hasLocation) return "Nearby agri shops need the farm location; it is not set.";
    return stores.length
      ? `Nearest agri shops: ${stores.slice(0, 3).map((s) => `${s.name}, ${s.type}, ${s.distanceKm.toFixed(1)} km`).join("; ")}.`
      : "No agri shops found nearby.";
  });

  if (loading) {
    return (
      <SafeAreaView edges={["left", "right"]} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container} scrollEnabled={false}>
          <SkeletonHeader />
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <Reveal>
      <SafeAreaView edges={["left", "right"]} style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.headerRow}>
            <Text style={styles.subtitle}>Fertilizer, seed &amp; agri shops near you — sorted by distance.</Text>
          </View>

          {!hasLocation && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t("stores.noLocationTitle")}</Text>
              <Text style={styles.cardBody}>Set your house location during registration to find nearby stores.</Text>
            </View>
          )}

          {hasLocation && stores.length === 0 && (
            <View style={styles.card}>
              <Text style={styles.cardBody}>{t("stores.emptyTitle", { n: 25 })}</Text>
            </View>
          )}

          {stores.map((s) => (
            <StoreCard key={s.id} store={s} />
          ))}
        </ScrollView>
      </SafeAreaView>
    </Reveal>
  );
}

function StoreCard({ store }: { store: Store }) {
  const { t } = useT();
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${store.lat},${store.lng}`;
  return (
    <Pressable onPress={() => Linking.openURL(mapsUrl)} style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{store.name}</Text>
          <Text style={styles.cardMeta}>
            {store.type} · {store.distanceKm} km away
          </Text>
        </View>
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingText}>★ {store.rating}</Text>
        </View>
      </View>
      <Text style={styles.linkText}>{t("stores.openInMaps")}</Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  container: { padding: 20, gap: 12, paddingBottom: 48 },

  headerRow: { marginBottom: 4, gap: 3 },
  eyebrow: { fontSize: 12, fontWeight: "700", letterSpacing: 1, color: colors.leaf },
  greeting: { fontSize: 24, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: 13, color: colors.textFaint },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.sageLine,
    borderRadius: 24,
    padding: 16,
    gap: 8,
    ...cardShadow,
  },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  cardMeta: { fontSize: 12, color: colors.textFaint, marginTop: 2 },
  cardBody: { fontSize: 13, color: colors.textSoft, lineHeight: 19 },
  ratingBadge: { backgroundColor: colors.sage, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  ratingText: { fontSize: 12, fontWeight: "700", color: colors.primary },
  linkText: { fontSize: 12, fontWeight: "700", color: colors.primary },
}));
