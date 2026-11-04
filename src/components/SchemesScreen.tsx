import { useCallback, useEffect, useState } from "react";
import { useT } from "./i18n/LanguageProvider";
import { ActivityIndicator, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/components/ui/Pressable";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDashboardData } from "@/lib/dashboard";
import { getSchemeDesk, SCHEMES, type Scheme } from "@/lib/schemes";
import { matchSchemes, type SchemeMatchResult } from "@/lib/schemeMatch";
import { colors } from "@/constants/colors";
import { cardShadow } from "@/constants/effects";

import { themed } from "@/theme";
import { useScreenDescriber } from "@/lib/agent/screenRegistry";
export function SchemesScreen() {
  const { t, locale } = useT();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [match, setMatch] = useState<SchemeMatchResult>(null);
  /*
    The state-matched list. Starts as the eight curated central schemes so the
    screen renders immediately and still works offline, then widens once the
    desk answers. Before this the app only ever showed those eight — the same
    list for a farmer in Maharashtra and one in Punjab, with no state subsidy
    ever appearing.
  */
  const [schemes, setSchemes] = useState<Scheme[]>(SCHEMES);
  const [provenance, setProvenance] = useState<string>("builtin");
  const [state, setState] = useState<string | null>(null);

  const load = useCallback(async () => {
    const dash = await getDashboardData();
    const farmer = dash.farmer;
    const crops = Array.from(new Set(dash.farms.map((f) => f.crop?.chosen_crop).filter(Boolean)));
    const totalArea = dash.farms.reduce((s, f) => s + (f.area || 0), 0);
    const soils = Array.from(new Set(dash.farms.map((f) => f.soil_type)));
    const profile = farmer
      ? `${farmer.name}, ${dash.farms.length} farm(s) totalling ${totalArea} acres of ${soils.join(", ")}, growing ${
          crops.join(", ") || "no crop yet"
        }, located at ${farmer.house_address ?? "India"}`
      : "an Indian smallholder farmer";
    const desk = await getSchemeDesk();
    setSchemes(desk.schemes);
    setProvenance(desk.provenance);
    setState(desk.state);
    setMatch(await matchSchemes(profile, desk.schemes, locale));
  }, [locale]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  useScreenDescriber("/schemes", () => {
    if (loading) return "";
    const byId = new Map(schemes.map((s) => [s.id, s]));
    const top = (match?.matches ?? []).slice(0, 3).map((m) => `${byId.get(m.id)?.name ?? m.id}: ${m.why}`);
    return top.length
      ? `Government schemes this farmer may qualify for: ${top.join("; ")}.`
      : `Government schemes: ${schemes.slice(0, 4).map((s) => `${s.name} (${s.benefit})`).join("; ")}.`;
  });

  const reasonFor = (id: string) => match?.matches.find((m) => m.id === id)?.why;
  const matchedIds = new Set(match?.matches.map((m) => m.id) ?? []);
  const ranked = [...schemes].sort((a, b) => Number(matchedIds.has(b.id)) - Number(matchedIds.has(a.id)));

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>{t("schemes.subtitle")}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : match?.headline ? (
          <View style={styles.aiCard}>
            <Text style={styles.aiLabel}>{t("schemes.matchedForYou")}</Text>
            <Text style={styles.aiHeadline}>{match.headline}</Text>
          </View>
        ) : null}

        {ranked.map((s) => (
          <SchemeCard key={s.id} scheme={s} why={reasonFor(s.id)} />
        ))}

        {/* Where the list came from. A state scheme read off a live portal
            this week and a central one hardcoded last year are not the same
            kind of fact, and the farmer should be able to tell them apart. */}
        {provenance !== "builtin" ? (
          <Text style={styles.provenance}>
            {t("schemes.provenance", {
              state: state ?? "your state",
              source: provenance,
            })}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SchemeCard({ scheme, why }: { scheme: Scheme; why?: string }) {
  const { t } = useT();
  return (
    <View style={[styles.card, why && styles.cardMatched]}>
      <View style={styles.cardHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{scheme.name}</Text>
          <Text style={styles.cardMeta}>{scheme.short}</Text>
        </View>
        <View style={styles.catBadge}>
          <Text style={styles.catBadgeText}>{scheme.category}</Text>
        </View>
      </View>

      {why && (
        <View style={styles.whyBox}>
          <Text style={styles.whyText}>{why}</Text>
        </View>
      )}

      <Text style={styles.cardBody}>{scheme.benefit}</Text>

      <View style={styles.chipRow}>
        {scheme.eligibility.slice(0, 2).map((e) => (
          <View key={e} style={styles.chip}>
            <Text style={styles.chipText}>{e}</Text>
          </View>
        ))}
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.deadline}>{scheme.deadline}</Text>
        <Pressable onPress={() => Linking.openURL(scheme.link)}>
          <Text style={styles.linkText}>{t("schemes.visitSite")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  provenance: { fontSize: 12, color: colors.textFaint, lineHeight: 17, marginTop: 4 },

  safe: { flex: 1, backgroundColor: "transparent" },
  container: { padding: 20, gap: 14, paddingBottom: 48 },

  headerRow: { marginBottom: 4, gap: 3 },
  eyebrow: { fontSize: 12, fontWeight: "700", letterSpacing: 1, color: colors.leaf },
  greeting: { fontSize: 24, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: 13, color: colors.textFaint },

  aiCard: { backgroundColor: colors.sage, borderRadius: 16, padding: 14, gap: 4 },
  aiLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: colors.primary },
  aiHeadline: { fontSize: 13, fontWeight: "600", color: colors.ink },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.sageLine,
    borderRadius: 24,
    padding: 16,
    gap: 8,
    ...cardShadow,
  },
  cardMatched: { borderColor: colors.primary + "80" },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  cardMeta: { fontSize: 12, color: colors.textFaint, marginTop: 1 },
  catBadge: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.sageLine, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  catBadgeText: { fontSize: 12, fontWeight: "700", color: colors.textSoft },

  whyBox: { backgroundColor: colors.sage, borderRadius: 8, padding: 8 },
  whyText: { fontSize: 12, fontWeight: "600", color: colors.primary },

  cardBody: { fontSize: 13, color: colors.textSoft, lineHeight: 18 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.sageLine, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.textSoft },

  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  deadline: { fontSize: 12, color: colors.textFaint },
  linkText: { fontSize: 12, fontWeight: "700", color: colors.primary },
}));
