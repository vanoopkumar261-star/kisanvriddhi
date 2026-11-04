import { StyleSheet, Text, View } from "react-native";

import type { ExpensesData } from "@/lib/expenses";
import { useT } from "./i18n/LanguageProvider";
import { colors, radius, space, tabularNums, type, themed } from "@/theme";

/**
 * Where the money went, ranked.
 *
 * A ranked horizontal bar rather than the pie the question usually attracts:
 * the job here is comparing magnitudes ("is fertiliser or labour eating more?")
 * and angle is the hardest encoding to compare by eye. Length against a shared
 * baseline is the easiest.
 *
 * One series, so one hue and no legend — the category names are the identity
 * and they are already text. That also means there is no categorical palette
 * to get wrong: nothing here depends on telling two colours apart.
 *
 * Deliberately small. The website has a fuller chart set; what was missing on
 * the phone was any sense of proportion at all, and a ranked list of bars
 * gives that in the space a phone actually has.
 */
export function ExpenseChart({ data }: { data: ExpensesData }) {
  const { t } = useT();
  const rows = data.byCategory.filter((c) => c.amount > 0).slice(0, 6);
  if (rows.length < 2) return null; // one bar compares nothing

  const max = Math.max(...rows.map((r) => r.amount));
  const rupee = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("expenses.byCategory")}</Text>

      {rows.map((r) => {
        // Floored so the smallest category is still a visible mark rather
        // than a sliver that reads as zero.
        const pct = Math.max(3, (r.amount / max) * 100);
        return (
          <View key={r.category} style={styles.row}>
            <View style={styles.rowHead}>
              <Text style={styles.cat} numberOfLines={1}>
                {r.category}
              </Text>
              <Text style={styles.amount}>{rupee(r.amount)}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.bar, { width: `${pct}%` }]} />
            </View>
          </View>
        );
      })}

      <Text style={styles.footnote}>
        {t("expenses.chartFootnote", { total: rupee(data.totalExpense) })}
      </Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.xs,
  },
  title: { ...type.card, color: colors.text, fontWeight: "800" },
  row: { gap: 4 },
  rowHead: { flexDirection: "row", alignItems: "baseline", gap: space.xs },
  cat: { ...type.secondary, color: colors.textSecondary, flex: 1, minWidth: 0 },
  // Values wear text tokens, never the series colour — the bar beside them
  // already carries that.
  amount: { ...type.secondary, ...tabularNums, color: colors.text, fontWeight: "700" },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.bgSunken, overflow: "hidden" },
  bar: { height: 8, borderRadius: radius.pill, backgroundColor: colors.primary },
  footnote: { ...type.meta, color: colors.textMuted, marginTop: 2 },
}));
