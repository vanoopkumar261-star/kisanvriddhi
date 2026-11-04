import { addTxn, deleteTxn, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../expenses";
import { getDashboardData } from "../dashboard";
import { lookupInputPrices, type InputCategory } from "../inputPrices";
import { getSchemeDesk } from "../schemes";
import { getNearbyStores } from "../stores";
import { getWeather, type WeatherData } from "../weather";
import { getMarket } from "../market";
import { agentContextStore } from "./context";
import { recordAction } from "./log";
import type { ToolCall } from "./turn";

type T = (key: string, params?: Record<string, string | number>) => string;

export type ToolExecutionResult = { ok: true; summary: string } | { ok: false; reason: string };

/** Today's date as a YYYY-MM-DD key, for dating a ledger write. */
const todayKey = () => new Date().toISOString().slice(0, 10);

/**
 * Runs a tool call the model asked for in /api/agent/turn's response.
 *
 * This is the ONLY place a voice-originated write actually happens — the
 * server never touches the database (see the route's own docstring). Every
 * argument is re-validated here rather than trusted, because the model can
 * be wrong about a type or send a category that doesn't exist even when its
 * schema said not to.
 *
 * This prototype (Platform Services) ships only the marketplace/advisory
 * tools; the farm-advisory tools (check_irrigation, set_soil_ph, …) belong to
 * the Farm Assistance work and are not part of this program.
 */
export async function executeToolCall(call: ToolCall, t: T): Promise<ToolExecutionResult> {
  switch (call.name) {
    case "log_expense":
      return executeLogExpense(call.args, t);
    case "check_price":
      return executeCheckPrice(call.args, t);
    case "check_input_price":
      return executeCheckInputPrice(call.args, t);
    case "find_store":
      return executeFindStore(call.args, t);
    case "check_scheme":
      return executeCheckScheme(t);
    default:
      return { ok: false, reason: t("agent.errorGeneric") };
  }
}

/**
 * The farmer and the weather, fetched once. find_store needs the farmer's
 * position; weather is allowed to fail on its own without blocking the lookup.
 */
async function farmContext(): Promise<{
  farmerId: string | null;
  farmer: Awaited<ReturnType<typeof getDashboardData>>["farmer"];
  weather: WeatherData | null;
}> {
  const dash = await getDashboardData();
  const lat = dash.farmer?.house_lat;
  const lng = dash.farmer?.house_lng;
  const weather = lat != null && lng != null ? await getWeather(lat, lng).catch(() => null) : null;
  return { farmerId: dash.farmer?.id ?? null, farmer: dash.farmer, weather };
}

/** What a bag of urea costs. Live web lookup, so it cannot come from context. */
async function executeCheckInputPrice(args: Record<string, unknown>, t: T): Promise<ToolExecutionResult> {
  const item = typeof args.item === "string" ? args.item.trim() : "";
  if (!item) return { ok: false, reason: t("agent.errorGeneric") };
  const asked = typeof args.category === "string" ? args.category : "";
  const category: InputCategory =
    asked === "seed" || asked === "pesticide" || asked === "fertiliser" ? asked : "fertiliser";

  const outcome = await lookupInputPrices(category, item);
  if (!outcome.ok || !outcome.report.rows.length) {
    return { ok: false, reason: t("agent.noInputPrice", { item }) };
  }
  // Cheapest first is the answer a farmer actually wants from "what does it cost".
  const best = [...outcome.report.rows].sort((a, b) => a.priceInr - b.priceInr)[0];
  return {
    ok: true,
    summary: t("agent.inputPrice", {
      item: best.productName || item,
      price: Math.round(best.priceInr).toLocaleString("en-IN"),
      unit: best.unit,
      shop: best.siteLabel,
    }),
  };
}

/** The nearest shop, and how far. Needs the phone's own position. */
async function executeFindStore(args: Record<string, unknown>, t: T): Promise<ToolExecutionResult> {
  const item = typeof args.item === "string" ? args.item.trim() : "";
  let stores: Awaited<ReturnType<typeof getNearbyStores>>;
  try {
    const ctx = await farmContext();
    const lat = ctx.farmer?.house_lat;
    const lng = ctx.farmer?.house_lng;
    if (lat == null || lng == null) return { ok: false, reason: t("agent.noLocation") };
    stores = await getNearbyStores(lat, lng);
  } catch {
    return { ok: false, reason: t("agent.errorOffline") };
  }
  if (!stores.length) return { ok: false, reason: t("agent.noStores") };

  const nearest = stores[0];
  return {
    ok: true,
    summary: t(item ? "agent.storeNearFor" : "agent.storeNear", {
      item,
      name: nearest.name,
      km: nearest.distanceKm.toFixed(1),
    }),
  };
}

/** The most relevant scheme and what it pays. No second AI call — latency matters more. */
async function executeCheckScheme(t: T): Promise<ToolExecutionResult> {
  let desk: Awaited<ReturnType<typeof getSchemeDesk>>;
  try {
    desk = await getSchemeDesk();
  } catch {
    return { ok: false, reason: t("agent.errorOffline") };
  }
  if (!desk.schemes.length) return { ok: false, reason: t("agent.noSchemes") };

  // A live, state-specific row beats a national built-in: it is the one the
  // farmer is least likely to already know about.
  const pick = desk.schemes.find((s) => s.source === "live") ?? desk.schemes[0];
  return {
    ok: true,
    summary: t("agent.schemeSay", { name: pick.name, benefit: pick.benefit }),
  };
}

/**
 * Says a crop's mandi price out loud instead of opening the market screen.
 *
 * A price is one number and a farmer with their hands full should not have to
 * look at a screen for it. Reads only — nothing here writes.
 */
/** How many crops to read out for a general "what are the prices" request before summarising the rest. */
const MAX_SPOKEN_PRICES = 6;

/**
 * A bare "prices"/"rates"/"mandi" with no real crop. The server tool now makes
 * `crop` optional and routes a general request here with it omitted, but a
 * misheard utterance can still land one of these generic words in `crop`, so
 * they are treated the same as no crop: read every crop out, don't hunt for a
 * crop called "all".
 */
const GENERIC_PRICE_WORD = /^(all|everything|every ?crop|prices?|rates?|mandi|market|सब|सभी|भाव|दाम|रेट|मंडी)$/i;

async function executeCheckPrice(args: Record<string, unknown>, t: T): Promise<ToolExecutionResult> {
  const asked = typeof args.crop === "string" ? args.crop.trim() : "";

  let snapshot: Awaited<ReturnType<typeof getMarket>>;
  try {
    const dash = await getDashboardData();
    snapshot = await getMarket(dash.farmer?.house_address ?? null);
  } catch {
    return { ok: false, reason: t("agent.errorOffline") };
  }

  const crops = (snapshot?.crops ?? []).filter((c) => !c.notAvailable);

  // General request — no crop named (or a generic price word): read them all.
  if (!asked || GENERIC_PRICE_WORD.test(asked)) {
    if (!crops.length) return { ok: false, reason: t("agent.pricesNone") };
    const head = crops
      .slice(0, MAX_SPOKEN_PRICES)
      .map((c) => t("agent.priceItem", { crop: c.name, price: c.price }))
      .join(", ");
    const more =
      crops.length > MAX_SPOKEN_PRICES ? t("agent.pricesMore", { n: crops.length - MAX_SPOKEN_PRICES }) : "";
    return { ok: true, summary: `${t("agent.pricesAll", { list: head })}${more}` };
  }

  if (!crops.length) return { ok: false, reason: t("agent.noPrice", { crop: asked }) };

  const needle = asked.toLowerCase();
  const crop =
    crops.find((c) => c.name.toLowerCase() === needle) ??
    crops.find((c) => c.name.toLowerCase().includes(needle) || needle.includes(c.name.toLowerCase()));
  if (!crop) return { ok: false, reason: t("agent.noPrice", { crop: asked }) };

  // A read, so nothing goes in the activity log — there is nothing to undo.
  return {
    ok: true,
    summary: t("agent.price", {
      crop: crop.name,
      price: crop.price,
      unit: crop.unit,
      direction: t(crop.change >= 0 ? "agent.priceUp" : "agent.priceDown"),
      change: Math.abs(crop.change),
    }),
  };
}

/**
 * The last committed ledger write, for de-duplication. The always-on voice
 * loop can transcribe its own spoken confirmation (which says the amount out
 * loud) or keep the just-logged sale in its short history, and so ask to record
 * the SAME transaction again a second or two later — which is how "I sold cotton
 * for 40k" ended up added several times over. A ledger is not allowed to
 * double-count, so an identical write inside this window is a no-op success.
 */
const DUP_WINDOW_MS = 45_000;
let lastLogWrite: { sig: string; at: number } | null = null;

async function executeLogExpense(args: Record<string, unknown>, t: T): Promise<ToolExecutionResult> {
  const farmerId = agentContextStore.getState().farmerId;
  if (!farmerId) return { ok: false, reason: t("agent.errorOffline") };

  const kind = args.kind === "income" ? "income" : args.kind === "expense" ? "expense" : null;
  const amount = typeof args.amount === "number" && Number.isFinite(args.amount) && args.amount > 0 ? args.amount : null;
  const itemName = typeof args.item_name === "string" && args.item_name.trim() ? args.item_name.trim().slice(0, 80) : null;
  if (!kind || !amount || !itemName) return { ok: false, reason: t("agent.errorGeneric") };

  const validCategories = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const requested = typeof args.category === "string" ? args.category : "";
  const category = validCategories.includes(requested) ? requested : "Other";

  // Refuse an identical write made moments ago (see lastLogWrite above): same
  // farmer, kind, amount and item is the same transaction, not a second one.
  const sig = `${farmerId}|${kind}|${amount}|${itemName.toLowerCase()}`;
  const now = Date.now();
  if (lastLogWrite && lastLogWrite.sig === sig && now - lastLogWrite.at < DUP_WINDOW_MS) {
    return { ok: true, summary: t("agent.alreadyLogged") };
  }

  const { error, id } = await addTxn({
    farmerId,
    kind,
    category,
    itemName,
    amount,
    txnDate: todayKey(),
  });
  if (error || !id) return { ok: false, reason: t("agent.errorGeneric") };
  lastLogWrite = { sig, at: now };

  await recordAction({
    tool: "log_expense",
    args: { kind, category, itemName, amount },
    summary: `Logged ₹${amount.toLocaleString("en-IN")} for ${category}`,
    inverse: { tool: "delete_expense", args: { id } },
  });

  return { ok: true, summary: `${category} — ₹${amount.toLocaleString("en-IN")}` };
}

/**
 * The inverse side of the table above — what `markUndone` in voice.tsx
 * actually runs. Kept separate from executeToolCall because an inverse is
 * never something the model asks for; it only ever comes from a log entry
 * this app wrote itself.
 */
export async function executeInverse(inverse: { tool: string; args: Record<string, unknown> }): Promise<boolean> {
  if (inverse.tool === "delete_expense" && typeof inverse.args.id === "string") {
    const { error } = await deleteTxn(inverse.args.id);
    return !error;
  }
  return false;
}
