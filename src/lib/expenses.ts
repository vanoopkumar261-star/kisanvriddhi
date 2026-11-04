import { supabase } from "./supabase";

/**
 * Client-side equivalent of the web app's lib/expenses.ts + expenses-server.ts.
 * RLS (farmer owns the row via farmer_id -> farmer_profiles.owner_id) enforces
 * scoping the same way it does server-side, so this reads/writes farm_expenses
 * directly — same pattern as lib/dashboard.ts.
 */

export type Txn = {
  id: string;
  farmer_id: string | null;
  kind: "expense" | "income";
  category: string;
  item_name: string;
  amount: number;
  txn_date: string;
  created_at: string | null;
};

export const EXPENSE_CATEGORIES = [
  "Seeds",
  "Fertilizer",
  "Pesticide",
  "Labor",
  "Machinery",
  "Irrigation",
  "Transport",
  "Other",
];

export const INCOME_CATEGORIES = ["Crop Sale", "Subsidy", "Other"];

export type ExpensesData = {
  txns: Txn[];
  totalIncome: number;
  totalExpense: number;
  profit: number;
  byCategory: { category: string; amount: number }[];
};

export async function getExpensesData(farmerId: string): Promise<ExpensesData> {
  const { data, error } = await supabase
    .from("farm_expenses")
    .select("*")
    .eq("farmer_id", farmerId)
    .order("txn_date", { ascending: false });

  if (error) console.error("EXPENSES fetch error:", error);
  const txns = (data ?? []) as Txn[];

  let totalIncome = 0;
  let totalExpense = 0;
  const catMap: Record<string, number> = {};

  for (const t of txns) {
    const amt = Number(t.amount) || 0;
    if (t.kind === "income") totalIncome += amt;
    else {
      totalExpense += amt;
      catMap[t.category] = (catMap[t.category] ?? 0) + amt;
    }
  }

  const byCategory = Object.entries(catMap)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return { txns, totalIncome, totalExpense, profit: totalIncome - totalExpense, byCategory };
}

export async function addTxn(input: {
  farmerId: string;
  kind: "expense" | "income";
  category: string;
  itemName: string;
  amount: number;
  txnDate: string;
}): Promise<{ error: string | null; id: string | null }> {
  // `id` is returned (not just the error) so a caller that needs to undo this
  // insert — the voice agent's tool executor — has something to delete.
  const { data, error } = await supabase
    .from("farm_expenses")
    .insert([
      {
        farmer_id: input.farmerId,
        kind: input.kind,
        category: input.category,
        item_name: input.itemName,
        amount: input.amount,
        txn_date: input.txnDate,
      },
    ])
    .select("id")
    .single();
  return { error: error?.message ?? null, id: data?.id ?? null };
}

export async function deleteTxn(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("farm_expenses").delete().eq("id", id);
  return { error: error?.message ?? null };
}
