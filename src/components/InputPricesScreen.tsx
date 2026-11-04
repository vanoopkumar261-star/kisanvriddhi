import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Pressable } from "@/components/ui/Pressable";

import {
  INPUT_CATEGORIES,
  lookupInputPrices,
  type InputCategory,
  type InputPriceReport,
} from "@/lib/inputPrices";
import { useScreenDescriber } from "@/lib/agent/screenRegistry";
import { useT } from "./i18n/LanguageProvider";
import { EmptyState } from "./ui/EmptyState";
import { cardShadow, colors, radius, space, tabularNums, type, themed } from "@/theme";

/**
 * What an input costs, before the farmer drives to the shop.
 *
 * The store locator has always answered "where"; this answers "how much". They
 * are different questions, and until now the app only had the first — so "where
 * can I buy urea" by voice gave directions and no price.
 *
 * Prices come from the website's live-web ladder and are shown with their
 * provenance attached, exactly as the server reported it. These are listings
 * from retail sites, not a mandi rate: the wording says so rather than letting
 * a number imply more authority than it has.
 */
export function InputPricesScreen() {
  const { t } = useT();
  const [category, setCategory] = useState<InputCategory>("fertiliser");
  const [term, setTerm] = useState("");
  const [report, setReport] = useState<InputPriceReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function search() {
    if (inFlight.current || !term.trim()) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const out = await lookupInputPrices(category, term);
    inFlight.current = false;
    setBusy(false);
    if (out.ok) setReport(out.report);
    else {
      setError(out.error);
      setReport(null);
    }
  }

  useScreenDescriber("/inputs", () => {
    if (busy) return "Checking input prices now.";
    if (!report) return "Input prices. The farmer can look up what seed, fertiliser or pesticide costs.";
    if (!report.rows.length) return `No prices found for ${report.term}.`;
    const best = report.rows[0];
    return (
      `${report.rows.length} prices for ${report.term}. ` +
      `Cheapest listed is ${best.productName} at ${best.priceInr} rupees per ${best.unit} on ${best.siteLabel}. ` +
      `These are retail listings, not a mandi rate.`
    );
  });

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.chips}>
        {INPUT_CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            accessibilityRole="button"
            accessibilityState={{ selected: c === category }}
            style={[styles.chip, c === category && styles.chipActive]}
          >
            <Text style={[styles.chipText, c === category && styles.chipTextActive]}>
              {t(`inputs.category.${c}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={term}
          onChangeText={setTerm}
          onSubmitEditing={search}
          placeholder={t("inputs.placeholder")}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          returnKeyType="search"
        />
        <Pressable onPress={search} disabled={busy} accessibilityRole="button" style={styles.searchBtn}>
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <MaterialCommunityIcons name="magnify" size={20} color={colors.onPrimary} />
          )}
        </Pressable>
      </View>

      {busy ? <Text style={styles.note}>{t("inputs.checking")}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {report && report.rows.length > 0 ? (
        <>
          {report.rows.map((r) => (
            <Pressable
              key={`${r.siteId}-${r.productName}`}
              onPress={() => r.url && Linking.openURL(r.url)}
              accessibilityRole="link"
              style={[styles.row, cardShadow]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.product} numberOfLines={2}>
                  {r.productName}
                </Text>
                <Text style={styles.site}>{r.siteLabel}</Text>
              </View>
              <View style={styles.priceCol}>
                <Text style={styles.price}>₹{r.priceInr.toLocaleString("en-IN")}</Text>
                <Text style={styles.unit}>{r.unit}</Text>
              </View>
            </Pressable>
          ))}

          {/* Shown as the server wrote it. These are shop listings, not a
              regulated price, and the farmer should be able to see which. */}
          <Text style={styles.provenance}>{report.provenance}</Text>
          {report.missing.length > 0 ? (
            <Text style={styles.note}>
              {t("inputs.missing", {
                sites: report.missing.map((m) => m.siteLabel).join(", "),
              })}
            </Text>
          ) : null}
        </>
      ) : null}

      {report && report.rows.length === 0 && !busy ? (
        <EmptyState icon="pricetag-outline" title={t("inputs.noneTitle")} body={t("inputs.noneBody")} />
      ) : null}

      {!report && !busy && !error ? (
        <EmptyState icon="pricetag-outline" title={t("inputs.startTitle")} body={t("inputs.startBody")} />
      ) : null}
    </ScrollView>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { padding: space.md, gap: space.sm, paddingBottom: space.xxl },

  chips: { flexDirection: "row", gap: space.xs },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...type.secondary, color: colors.textSecondary, fontWeight: "600" },
  chipTextActive: { color: colors.onPrimary },

  searchRow: { flexDirection: "row", gap: space.xs, alignItems: "center" },
  input: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    paddingHorizontal: 14,
    paddingVertical: 11,
    ...type.body,
    color: colors.text,
  },
  searchBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.card,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space.sm,
  },
  product: { ...type.secondary, color: colors.text, fontWeight: "600" },
  site: { ...type.meta, color: colors.textMuted, marginTop: 1 },
  priceCol: { alignItems: "flex-end" },
  price: { ...type.card, ...tabularNums, color: colors.text, fontWeight: "800" },
  unit: { ...type.meta, color: colors.textMuted },

  note: { ...type.meta, color: colors.textMuted, lineHeight: 16 },
  provenance: { ...type.meta, color: colors.textMuted, lineHeight: 16, marginTop: 2 },
  error: { ...type.secondary, color: colors.danger },
}));
