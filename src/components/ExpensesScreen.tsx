import { colors as themeColors } from "@/theme/colors";
import { useCallback, useEffect, useState } from "react";
import { useT } from "./i18n/LanguageProvider";
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Pressable } from "@/components/ui/Pressable";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDashboardData } from "@/lib/dashboard";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  addTxn,
  deleteTxn,
  getExpensesData,
  type ExpensesData,
  type Txn,
} from "@/lib/expenses";
import { colors } from "@/constants/colors";
import { cardShadow } from "@/constants/effects";
import { EmptyState } from "./ui/EmptyState";
import { SkeletonHeader, SkeletonCard, SkeletonTile } from "./ui/Skeleton";
import { Reveal } from "./ui/Reveal";
import { themed } from "@/theme";
import { useScreenDescriber } from "@/lib/agent/screenRegistry";
import { getPlanState } from "@/lib/plan";
import { atLeast, planOf, type PlanId } from "@/lib/plans";
import { ExpenseChart } from "./ExpenseChart";
import { GATES, PlanLocked } from "./PlanLocked";

const rupee = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;
const todayISO = () => new Date().toISOString().slice(0, 10);

export function ExpensesScreen() {
  const { t } = useT();
  const [farmerId, setFarmerId] = useState<string | null>(null);
  const [data, setData] = useState<ExpensesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [saving, setSaving] = useState(false);
  // Null while unknown — see IrrigationScreen for why the lock waits.
  const [plan, setPlan] = useState<PlanId | null>(null);

  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());

  const cats = kind === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const load = useCallback(async () => {
    const dash = await getDashboardData();
    setFarmerId(dash.farmer?.id ?? null);
    if (dash.farmer?.id) setData(await getExpensesData(dash.farmer.id));
    const state = await getPlanState();
    setPlan(state ? planOf(state.plan) : "elite");
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function switchKind(k: "expense" | "income") {
    setKind(k);
    setCategory((k === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES)[0]);
  }

  async function submit() {
    const amt = Number(amount);
    if (!farmerId || !desc.trim() || !amt || amt <= 0) return;
    setSaving(true);
    const { error } = await addTxn({
      farmerId,
      kind,
      category,
      itemName: desc.trim(),
      amount: amt,
      txnDate: date,
    });
    setSaving(false);
    if (error) return;
    setDesc("");
    setAmount("");
    await load();
  }

  async function remove(id: string) {
    await deleteTxn(id);
    await load();
  }

  useScreenDescriber("/money", () => {
    if (loading || !data) return "";
    const recent = data.txns.slice(0, 3).map((x) => `${x.kind} ${x.item_name} ₹${x.amount} on ${x.txn_date}`).join("; ");
    return `Money: income ₹${data.totalIncome}, expenses ₹${data.totalExpense}, profit ₹${data.profit}. ` +
      (data.byCategory.length ? `Biggest costs: ${data.byCategory.slice(0, 3).map((c) => `${c.category} ₹${c.amount}`).join(", ")}. ` : "") +
      (recent ? `Latest entries: ${recent}.` : "No entries yet. The farmer can say what they spent, like 500 rupees on fertilizer.");
  });

  const gate = GATES.expenses!;
  if (!loading && plan && !atLeast(plan, gate.requiredPlan)) {
    return (
      <PlanLocked
        currentPlan={plan}
        requiredPlan={gate.requiredPlan}
        titleKey={gate.titleKey}
        bodyKey={gate.bodyKey}
      />
    );
  }

  if (loading) {
    return (
      <SafeAreaView edges={["left", "right"]} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container} scrollEnabled={false}>
          <SkeletonHeader />
          <View style={styles.statGrid}>
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonTile key={i} style={{ flexBasis: "31%" }} />
            ))}
          </View>
          <SkeletonCard lines={4} />
          <SkeletonCard lines={2} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!farmerId) {
    return (
      <SafeAreaView edges={["left", "right"]} style={styles.safe}>
        <View style={styles.container}>
          <Header />
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("expenses.noProfileTitle")}</Text>
            <Text style={styles.cardBody}>{t("expenses.noProfileBody")}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const txns = data?.txns ?? [];

  return (
    <Reveal>
      <SafeAreaView edges={["left", "right"]} style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Header />

          <View style={styles.statGrid}>
            <StatTile label="Income" value={rupee(data?.totalIncome ?? 0)} tone="income" />
            <StatTile label="Expense" value={rupee(data?.totalExpense ?? 0)} tone="expense" />
            <StatTile label="Profit" value={rupee(data?.profit ?? 0)} tone={(data?.profit ?? 0) >= 0 ? "income" : "expense"} />
          </View>

          {data ? <ExpenseChart data={data} /> : null}

          <View style={styles.card}>
            <Text style={styles.cardLabel}>{t("expenses.addTransaction")}</Text>

            <View style={styles.kindRow}>
              <Pressable
                onPress={() => switchKind("expense")}
                style={[styles.kindBtn, kind === "expense" && styles.kindBtnActiveExpense]}
              >
                <Text style={[styles.kindBtnText, kind === "expense" && styles.kindBtnTextActiveExpense]}>{t("expenses.spent")}</Text>
              </Pressable>
              <Pressable
                onPress={() => switchKind("income")}
                style={[styles.kindBtn, kind === "income" && styles.kindBtnActiveIncome]}
              >
                <Text style={[styles.kindBtnText, kind === "income" && styles.kindBtnTextActiveIncome]}>{t("expenses.earned")}</Text>
              </Pressable>
            </View>

            <View style={styles.chipRow}>
              {cats.map((c) => (
                <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipActive]}>
                  <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={desc}
              onChangeText={setDesc}
              placeholder={t("expenses.descPlaceholder")}
              placeholderTextColor={colors.textFaint}
              style={styles.input}
            />
            <View style={styles.row2}>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder={t("expenses.amountPlaceholder")}
                placeholderTextColor={colors.textFaint}
                keyboardType="numeric"
                style={[styles.input, styles.flex1]}
              />
              <TextInput
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textFaint}
                style={[styles.input, styles.flex1]}
              />
            </View>

            <Pressable
              onPress={submit}
              disabled={saving || !desc.trim() || !Number(amount)}
              style={[styles.submitBtn, (saving || !desc.trim() || !Number(amount)) && styles.submitBtnDisabled]}
            >
              <Text style={styles.submitBtnText}>{saving ? "Saving…" : `Add ${kind === "expense" ? "Expense" : "Income"}`}</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <View style={styles.ledgerHeaderRow}>
              <Text style={styles.cardLabel}>{t("expenses.ledger")}</Text>
              <Text style={styles.cardMeta}>{txns.length} entries</Text>
            </View>
            {txns.length === 0 ? (
              <EmptyState
                icon="receipt-outline"
                title="No transactions yet"
                body="Add your first income or expense above to start tracking your farm's ledger."
                tone="pink"
              />
            ) : (
              <View style={{ gap: 2, marginTop: 6 }}>
                {txns.map((t) => (
                  <TxnRow key={t.id} txn={t} onDelete={() => remove(t.id)} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Reveal>
  );
}

function Header() {
  const { t } = useT();
  return (
    <View style={styles.headerRow}>
      <Text style={styles.subtitle}>{t("expenses.subtitle")}</Text>
    </View>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string; tone: "income" | "expense" }) {
  return (
    <View style={styles.statTile}>
      <Text style={[styles.statValue, tone === "income" ? styles.statValueIncome : styles.statValueExpense]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TxnRow({ txn, onDelete }: { txn: Txn; onDelete: () => void }) {
  const { t } = useT();
  const income = txn.kind === "income";
  return (
    <View style={styles.txnRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.txnName}>{txn.item_name}</Text>
        <Text style={styles.txnMeta}>
          {txn.category} · {txn.txn_date}
        </Text>
      </View>
      <Text style={[styles.txnAmount, income && styles.txnAmountIncome]}>
        {income ? "+" : "−"}
        {rupee(txn.amount)}
      </Text>
      <Pressable onPress={onDelete} style={styles.deleteBtn}>
        <Text style={styles.deleteBtnText}>{t("expenses.delete")}</Text>
      </Pressable>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  container: { padding: 20, gap: 14, paddingBottom: 48 },

  headerRow: { marginBottom: 4, gap: 3 },
  eyebrow: { fontSize: 12, fontWeight: "700", letterSpacing: 1, color: colors.leaf },
  greeting: { fontSize: 24, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: 13, color: colors.textFaint },

  statGrid: { flexDirection: "row", gap: 10 },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.sageLine,
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  statValue: { fontSize: 15, fontWeight: "700" },
  statValueIncome: { color: colors.primary },
  statValueExpense: { color: colors.danger },
  statLabel: { fontSize: 12, fontWeight: "600", color: colors.textFaint, textTransform: "uppercase" },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.sageLine,
    borderRadius: 24,
    padding: 18,
    gap: 10,
    ...cardShadow,
  },
  cardLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: colors.leaf },
  cardTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  cardBody: { fontSize: 15, color: colors.textSoft, lineHeight: 20 },
  cardMeta: { fontSize: 12, fontWeight: "600", color: colors.textFaint },

  kindRow: { flexDirection: "row", gap: 8 },
  kindBtn: { flex: 1, borderWidth: 1, borderColor: colors.sageLine, borderRadius: 8, paddingVertical: 9, alignItems: "center" },
  kindBtnActiveExpense: { backgroundColor: colors.dangerBg, borderColor: colors.danger },
  kindBtnActiveIncome: { backgroundColor: colors.sage, borderColor: colors.primary },
  kindBtnText: { fontSize: 13, fontWeight: "700", color: colors.textFaint },
  kindBtnTextActiveExpense: { color: colors.danger },
  kindBtnTextActiveIncome: { color: colors.primary },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.sageLine, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.textSoft },
  chipTextActive: { color: themeColors.onPrimary },

  input: {
    borderWidth: 1,
    borderColor: colors.sageLine,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  row2: { flexDirection: "row", gap: 8 },
  flex1: { flex: 1 },

  submitBtn: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 12, alignItems: "center" },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: themeColors.onPrimary, fontWeight: "700", fontSize: 13 },

  ledgerHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  txnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.sageLine,
  },
  txnName: { fontSize: 13, fontWeight: "700", color: colors.ink },
  txnMeta: { fontSize: 12, color: colors.textFaint, marginTop: 1 },
  txnAmount: { fontSize: 13, fontWeight: "700", color: colors.ink },
  txnAmountIncome: { color: colors.primary },
  deleteBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  deleteBtnText: { fontSize: 12, fontWeight: "700", color: colors.danger },
}));
