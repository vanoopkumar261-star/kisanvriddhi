import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/components/ui/Pressable";
import { getDashboardData } from "@/lib/dashboard";
import {
  getMarket,
  getMandiRows,
  getMarketAdvice,
  type CropMarket,
  type MandiRow,
  type MarketAdvice,
  type MarketSnapshot,
} from "@/lib/market";
import { bodyFont, colors, displayFont, eyebrow, layout, radius, space, tabularNums, type, themed } from "@/theme";
import { useT } from "./i18n/LanguageProvider";
import { SkeletonHeader, SkeletonCard, SkeletonTile } from "./ui/Skeleton";
import { Reveal } from "./ui/Reveal";
import { HeroCard } from "./ui/HeroCard";
import { Card } from "./ui/Card";
import { Badge, ErrorState } from "./ui/Primitives";
import { TransportPlanner } from "./TransportPlanner";
import { useScreenDescriber } from "@/lib/agent/screenRegistry";

const rupee = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export function MarketScreen() {
  const { t, locale } = useT();
  const [houseAddress, setHouseAddress] = useState<string | null>(null);
  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(null);
  const [market, setMarket] = useState<MarketSnapshot | null>(null);
  const [farmerCrops, setFarmerCrops] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selected, setSelected] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const detailY = useRef(0);
  const [mandis, setMandis] = useState<MandiRow[]>([]);
  const [loadingMandis, setLoadingMandis] = useState(false);
  const [advice, setAdvice] = useState<MarketAdvice | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [planMandi, setPlanMandi] = useState<MandiRow | null>(null);

  const load = useCallback(async () => {
    const dash = await getDashboardData();
    setHouseAddress(dash.farmer?.house_address ?? null);
    // The farmer's saved location, for real mandi road distances.
    setOrigin(
      dash.farmer?.house_lat != null && dash.farmer?.house_lng != null
        ? { lat: dash.farmer.house_lat, lon: dash.farmer.house_lng }
        : null
    );
    setFarmerCrops(
      Array.from(new Set(dash.farms.map((f) => f.crop?.chosen_crop).filter(Boolean) as string[]))
    );
    const snap = await getMarket(dash.farmer?.house_address ?? null);
    setMarket(snap);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  /*
    Sell or hold. The screen has shown prices since it shipped and never said
    what to do with them, which leaves the hardest part of the question —
    timing — entirely to the farmer. Advisory and additive: a null answer just
    means the price list stands on its own, as it always has.
  */
  useEffect(() => {
    const crops = (market?.crops ?? []).filter((c) => !c.notAvailable);
    if (!crops.length) return;
    let alive = true;
    void getMarketAdvice({
      prices: crops,
      farmerCrops,
      locale,
      unavailableCrops: (market?.crops ?? []).filter((c) => c.notAvailable).map((c) => c.name),
      state: market?.state ?? null,
    }).then((a) => {
      if (alive) setAdvice(a);
    });
    return () => {
      alive = false;
    };
  }, [market, farmerCrops, locale]);

  // Pick a sensible default focus crop once market data + farmer crops are in:
  // the farmer's own crop if it's arriving at mandis today, else the first
  // available one.
  useEffect(() => {
    if (!market || selected) return;
    const available = market.crops.filter((c) => !c.notAvailable);
    const match = available.find((c) => farmerCrops.some((fc) => fc.toLowerCase() === c.name.toLowerCase()));
    setSelected((match ?? available[0])?.name ?? null);
  }, [market, farmerCrops, selected]);

  useEffect(() => {
    if (!selected) return;
    setLoadingMandis(true);
    setExpanded(null);
    getMandiRows(houseAddress, selected, origin)
      .then(setMandis)
      .finally(() => setLoadingMandis(false));
  }, [selected, houseAddress, origin]);

  async function onRefresh() {
    setRefreshing(true);
    setSelected(null);
    await load();
    setRefreshing(false);
  }

  useScreenDescriber("/market", () => {
    if (loading) return "";
    const crops = (market?.crops ?? []).filter((c) => !c.notAvailable);
    if (!crops.length) return "No mandi prices available for your crops right now.";
    const near = mandis
      .slice(0, 3)
      .map((m) => `${m.mandi} ₹${m.price}${m.distanceKm != null ? ` (${Math.round(m.distanceKm)} km)` : ""}`)
      .join(", ");
    return [
      `Mandi prices${market?.state ? ` in ${market.state}` : ""}: ` +
        crops.map((c) => `${c.name} ₹${c.price} per ${c.unit}, ${c.change >= 0 ? "up" : "down"} ${Math.abs(c.change)}%, demand ${c.demand}`).join("; ") + ".",
      near ? `Nearby mandis for ${selected ?? "the selected crop"}: ${near}.` : "",
    ].join(" ");
  });

  if (loading) {
    return (
      <ScrollView contentContainerStyle={styles.container} scrollEnabled={false}>
        <SkeletonHeader />
        <View style={styles.priceGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonTile key={i} style={{ flexBasis: "31%" }} />
          ))}
        </View>
        <SkeletonCard lines={2} />
        <SkeletonCard lines={3} />
      </ScrollView>
    );
  }

  const crops = market?.crops ?? [];
  const available = crops.filter((c) => !c.notAvailable);
  const unavailable = crops.filter((c) => c.notAvailable);
  const active = crops.find((c) => c.name === selected) ?? null;

  // The crop's detail sits below the price grid, off-screen on most phones, so
  // a tap used to change something the farmer couldn't see. Bring it into view.
  const pick = (name: string) => {
    setSelected(name);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, detailY.current - space.md), animated: true }));
  };

  return (
    <>
    <Reveal>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.headerRow}>
            <Text style={[styles.subtitle, { fontFamily: bodyFont(locale) }]}>{t("market.subtitle")}</Text>
            <Badge
              label={
                !market?.isRealData
                  ? t("marketBoard.demoPrices")
                  : (market.crops ?? []).some((c) => c.national)
                    ? t("market.national")
                    : t("market.live", { state: market.state ?? "" })
              }
              tone={market?.isRealData ? "positive" : "neutral"}
              icon={market?.isRealData ? "circle-slice-8" : "flask-outline"}
            />
          </View>

          {crops.length === 0 && (
            <ErrorState message={t("market.loadFailed")} onRetry={onRefresh} retryLabel={t("common.retry")} />
          )}

          {available.length > 0 && (
            <View style={styles.priceGrid}>
              {available.map((c) => (
                <PriceTile key={c.name} crop={c} active={c.name === selected} onPress={() => pick(c.name)} />
              ))}
            </View>
          )}

          {advice ? (
            <Card tone="soft">
              <Text style={[styles.adviceHeadline, { fontFamily: bodyFont(locale, "semi") }]}>
                {advice.headline}
              </Text>
              {advice.recommendations.slice(0, 4).map((r) => (
                <View key={r.crop} style={styles.adviceRow}>
                  <View
                    style={[
                      styles.actionPill,
                      r.action === "Sell now"
                        ? styles.actionSell
                        : r.action === "Hold"
                          ? styles.actionHold
                          : styles.actionWait,
                    ]}
                  >
                    <Text style={styles.actionText}>{r.action}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.adviceCrop, { fontFamily: bodyFont(locale, "semi") }]}>
                      {r.crop}
                    </Text>
                    <Text style={[styles.adviceReason, { fontFamily: bodyFont(locale) }]}>
                      {r.reason}
                    </Text>
                  </View>
                  {/* Confidence is shown rather than hidden: a 55% call and a
                      90% call are not the same advice, and a farmer deciding
                      when to sell is entitled to know which one this is. */}
                  <Text style={styles.adviceConf}>{Math.round(r.confidence * 100)}%</Text>
                </View>
              ))}
            </Card>
          ) : null}

          {active && (
            <View onLayout={(e) => (detailY.current = e.nativeEvent.layout.y)}>
            <HeroCard
              eyebrow={active.demand.toUpperCase()}
              title={active.name}
              meta={rupee(active.price) + (active.isReal && active.reportedOn ? ` · reported ${active.reportedOn}` : "")}
              badge={`${active.change >= 0 ? "▲" : "▼"} ${Math.abs(active.change)}% ${t("marketBoard.today")}`}
              icon={active.change >= 0 ? "trending-up" : "trending-down"}
              // Never red here. §41 reserves red for disease and danger, and a
              // 0.7% daily dip was rendering the whole card as an emergency.
              tone={active.change >= 0 ? "green" : "mustard"}
            />
            </View>
          )}

          {active && (
            <Card>
              <Text style={[eyebrow, styles.cardLabel, { fontFamily: bodyFont(locale, "semi") }]}>
                {t("marketBoard.nearbyMandis")}
              </Text>
              {loadingMandis ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: space.md }} />
              ) : mandis.length === 0 ? (
                <Text style={[styles.cardBody, { fontFamily: bodyFont(locale) }]}>
                  {t("marketBoard.noMandiData", { crop: active.name, region: t("marketBoard.yourRegion") })}
                </Text>
              ) : (
                <View style={{ gap: space.xs }}>
                  {mandis.map((m, i) => (
                    <MandiItem
                      key={m.mandi}
                      mandi={m}
                      isBest={i === 0}
                      expanded={expanded === m.mandi}
                      onToggle={() => setExpanded((e) => (e === m.mandi ? null : m.mandi))}
                      onPlan={() => setPlanMandi(m)}
                    />
                  ))}
                </View>
              )}
            </Card>
          )}

          {unavailable.length > 0 && (
            <Card tone="soft">
              <Text style={[eyebrow, styles.cardLabel, { fontFamily: bodyFont(locale, "semi") }]}>
                {t("marketBoard.notArriving", { state: market?.state ?? t("marketBoard.yourRegion") })}
              </Text>
              <Text style={[styles.cardBody, { fontFamily: bodyFont(locale) }]}>
                {unavailable.map((c) => c.name).join(", ")}
              </Text>
              <Text style={[styles.cardMeta, { fontFamily: bodyFont(locale) }]}>
                {t("marketBoard.whyMissingBody", { state: market?.state ?? t("marketBoard.yourRegion") })}
              </Text>
            </Card>
          )}
        </ScrollView>
    </Reveal>
    <TransportPlanner
      visible={!!planMandi}
      mandi={planMandi}
      cropName={selected}
      onClose={() => setPlanMandi(null)}
    />
    </>
  );
}

function PriceTile({ crop, active, onPress }: { crop: CropMarket; active: boolean; onPress: () => void }) {
  const { locale } = useT();
  const up = crop.change >= 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${crop.name} ${rupee(crop.price)}`}
      style={[styles.priceTile, active && styles.priceTileActive]}
    >
      <Text style={[styles.priceTileName, { fontFamily: bodyFont(locale, "semi") }]} numberOfLines={2}>
        {crop.name}
      </Text>
      <Text style={[styles.priceTileValue, tabularNums, { fontFamily: displayFont(locale) }]}>
        {rupee(crop.price)}
      </Text>
      {/* The arrow carries the direction as well as the colour — §41 forbids
          communicating status by hue alone. */}
      <Text style={[styles.priceTileChange, tabularNums, !up && styles.changeTextDown]}>
        {up ? "▲" : "▼"} {Math.abs(crop.change)}%
      </Text>
    </Pressable>
  );
}

function MandiItem({
  mandi,
  isBest,
  expanded,
  onToggle,
  onPlan,
}: {
  mandi: MandiRow;
  isBest: boolean;
  expanded: boolean;
  onToggle: () => void;
  onPlan: () => void;
}) {
  const { t, locale } = useT();
  return (
    <Pressable onPress={onToggle} style={[styles.mandiRow, isBest && styles.mandiRowBest]}>
      <View style={{ flex: 1 }}>
        <View style={styles.mandiTitleRow}>
          <Text style={[styles.mandiName, { fontFamily: bodyFont(locale, "semi") }]} numberOfLines={2}>
            {mandi.mandi}
          </Text>
          {isBest && <Badge label={t("marketBoard.best")} tone="positive" />}
        </View>
        <Text style={[styles.mandiMeta, tabularNums, { fontFamily: bodyFont(locale) }]}>
          {mandi.distanceKm != null ? `${mandi.distanceKm} km` : "—"} · {t("marketBoard.net")}{" "}
          <Text style={styles.mandiNet}>{rupee(mandi.netPrice)}</Text>
        </Text>
      </View>
      <Text style={[styles.mandiPrice, tabularNums, { fontFamily: displayFont(locale) }]}>
        {rupee(mandi.price)}
      </Text>

      {expanded && (
        <View style={styles.feeBreakdown}>
          <FeeRow label={t("marketBoard.quotedPrice")} value={rupee(mandi.price)} bold />
          {/* All six deductions stay listed. Drop any of them and the quoted
              price no longer reconciles with the net, which is the one number
              on this screen a farmer will check against what he was paid. */}
          <FeeRow label={t("marketBoard.marketFee")} value={`-₹${mandi.fees.marketFee.toFixed(2)}`} deduction />
          <FeeRow label={t("marketBoard.cess")} value={`-₹${mandi.fees.cess.toFixed(2)}`} deduction />
          <FeeRow label={t("marketBoard.commission")} value={`-₹${mandi.fees.commission.toFixed(2)}`} deduction />
          <FeeRow label={t("marketBoard.loadingUnloading")} value={`-₹${mandi.fees.loading.toFixed(2)}`} deduction />
          <FeeRow label={t("marketBoard.gunnyBags")} value={`-₹${mandi.fees.gunnyBag.toFixed(2)}`} deduction />
          <FeeRow label={t("marketBoard.weighingCharges")} value={`-₹${mandi.fees.weighing.toFixed(2)}`} deduction />
          <View style={styles.feeDivider} />
          <FeeRow label={t("marketBoard.netToYou")} value={rupee(mandi.netPrice)} highlight />
          <Pressable onPress={onPlan} style={styles.planBtn} accessibilityRole="button">
            <Text style={[styles.planBtnText, { fontFamily: bodyFont(locale, "semi") }]}>
              🚚 {t("transportPlanner.planCta")}
            </Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

function FeeRow({
  label,
  value,
  deduction,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  deduction?: boolean;
  bold?: boolean;
  highlight?: boolean;
}) {
  const { locale } = useT();
  return (
    <View style={styles.feeRow}>
      <Text
        style={[styles.feeLabel, bold && styles.feeLabelBold, highlight && styles.feeLabelHighlight, { fontFamily: bodyFont(locale) }]}
        numberOfLines={2}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.feeValue,
          tabularNums,
          deduction && styles.feeValueDeduction,
          highlight && styles.feeLabelHighlight,
          { fontFamily: bodyFont(locale, "semi") },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  adviceHeadline: { ...type.secondary, color: colors.text, fontWeight: "700", marginBottom: 6 },
  adviceRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 5 },
  actionPill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  actionSell: { backgroundColor: colors.optimal },
  actionHold: { backgroundColor: colors.attention },
  actionWait: { backgroundColor: colors.neutral },
  actionText: { ...type.meta, color: colors.onPrimary, fontWeight: "700" },
  adviceCrop: { ...type.secondary, color: colors.text },
  adviceReason: { ...type.meta, color: colors.textSecondary, lineHeight: 16 },
  adviceConf: { ...type.meta, ...tabularNums, color: colors.textMuted },

  container: {
    paddingHorizontal: layout.screenX,
    paddingBottom: layout.screenBottom,
    gap: layout.cardGap,
  },

  headerRow: { gap: space.xs },
  subtitle: { ...type.body, color: colors.textSecondary },

  cardLabel: { color: colors.leaf },
  cardBody: { ...type.body, color: colors.textSecondary },
  cardMeta: { ...type.secondary, color: colors.textMuted },

  changeTextDown: { color: colors.danger },

  priceGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  priceTile: {
    flexBasis: "31%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: space.sm,
    gap: 2,
    minHeight: 84,
  },
  priceTileActive: { borderColor: colors.primary, borderWidth: 2 },
  priceTileName: { ...type.secondary, color: colors.text },
  priceTileValue: { ...type.card, color: colors.text, fontWeight: "700" },
  priceTileChange: { ...type.meta, fontWeight: "700", color: colors.optimal },

  mandiRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: space.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.xs,
    minHeight: layout.touchTarget + 12,
  },
  mandiRowBest: { borderColor: colors.primary, backgroundColor: colors.surfaceSoft },
  planBtn: {
    marginTop: space.sm,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    paddingVertical: 10,
  },
  planBtnText: { fontSize: 12, color: colors.primary },
  mandiTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  mandiName: { ...type.body, color: colors.text, flexShrink: 1 },
  mandiMeta: { ...type.secondary, color: colors.textMuted, marginTop: 2 },
  mandiNet: { fontWeight: "700", color: colors.primary },
  mandiPrice: { ...type.section, color: colors.text, fontWeight: "700" },

  feeBreakdown: {
    width: "100%",
    marginTop: space.xs,
    gap: 5,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.xs,
  },
  feeRow: { flexDirection: "row", justifyContent: "space-between", gap: space.xs },
  feeLabel: { ...type.secondary, color: colors.textMuted, flex: 1 },
  feeLabelBold: { fontWeight: "700", color: colors.text },
  feeLabelHighlight: { fontWeight: "700", color: colors.primary },
  feeValue: { ...type.secondary, color: colors.text },
  feeValueDeduction: { color: colors.danger },
  feeDivider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
}));
