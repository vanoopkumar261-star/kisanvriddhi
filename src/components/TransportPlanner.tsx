import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "@/components/ui/Pressable";
import { bodyFont, colors, displayFont, radius, space, tabularNums } from "@/theme";
import { useT } from "./i18n/LanguageProvider";
import type { MandiRow } from "@/lib/market";

/**
 * The mobile half of the web's TransportPlanner — same five vehicles, same
 * cost/invoice maths, so the two surfaces give a farmer the same number. Opened
 * from a mandi row: pick how much is being sold, and it recommends the cheapest
 * vehicle and shows what actually lands in hand after transport.
 *
 * Real distances now, so this is a real figure: with no distance (a mandi we
 * could not locate yet) it says so and shows gross only, never a fake cost.
 */

const rupee = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

type Vehicle = { id: string; name: string; capacity: number; ratePerKm: number; minCharge: number; descKey: string; icon: string };

const VEHICLES: Vehicle[] = [
  { id: "tata_ace", name: "Tata Ace (Chota Hathi)", capacity: 8, ratePerKm: 15, minCharge: 400, descKey: "transportPlanner.vehicle.tata_ace.desc", icon: "🛻" },
  { id: "bolero_pickup", name: "Mahindra Bolero Pickup", capacity: 15, ratePerKm: 22, minCharge: 700, descKey: "transportPlanner.vehicle.bolero_pickup.desc", icon: "🚐" },
  { id: "tata_407", name: "Tata 407 (Medium Truck)", capacity: 35, ratePerKm: 35, minCharge: 1500, descKey: "transportPlanner.vehicle.tata_407.desc", icon: "🚚" },
  { id: "eicher_pro", name: "Eicher Pro (10-Tonne)", capacity: 100, ratePerKm: 60, minCharge: 3500, descKey: "transportPlanner.vehicle.eicher_pro.desc", icon: "🚛" },
  { id: "ashok_leyland", name: "Ashok Leyland (Multi-axle)", capacity: 250, ratePerKm: 110, minCharge: 7000, descKey: "transportPlanner.vehicle.ashok_leyland.desc", icon: "🚜" },
];

const IS_ROUND_TRIP = true;

function calcVehicleCost(v: Vehicle, distanceKm: number, weight: number) {
  const tripsNeeded = Math.ceil(weight / v.capacity);
  const chargedDistance = IS_ROUND_TRIP ? distanceKm * 2 : distanceKm;
  const tripCost = Math.max(v.minCharge, chargedDistance * v.ratePerKm);
  return { tripsNeeded, totalCost: Math.round(tripCost * tripsNeeded) };
}

export function TransportPlanner({
  mandi,
  cropName,
  visible,
  onClose,
}: {
  mandi: MandiRow | null;
  cropName: string | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const [weightText, setWeightText] = useState("50");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  if (!mandi) return null;

  const weight = Math.max(0.5, parseFloat(weightText) || 0.5);
  const distanceKm = mandi.distanceKm;
  const hasDistance = distanceKm != null;

  const vehiclesWithCost = VEHICLES.map((v) => {
    const { tripsNeeded, totalCost } = hasDistance
      ? calcVehicleCost(v, distanceKm, weight)
      : { tripsNeeded: Math.ceil(weight / v.capacity), totalCost: 0 };
    return { ...v, tripsNeeded, totalCost };
  });
  const recommended = vehiclesWithCost.reduce((a, b) => (a.totalCost < b.totalCost ? a : b));
  const activeVehicle = vehiclesWithCost.find((v) => v.id === (selectedVehicleId ?? recommended.id))!;

  const grossRevenue = Math.round(mandi.netPrice * weight);
  const finalEarnings = hasDistance ? Math.max(0, grossRevenue - activeVehicle.totalCost) : grossRevenue;

  const body = { fontFamily: bodyFont(locale) };
  const semi = { fontFamily: bodyFont(locale, "semi") };
  const display = { fontFamily: displayFont(locale) };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t("a11y.close")} />
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, semi]}>{t("transportPlanner.title")}</Text>
              <Text style={[styles.subtitle, body]} numberOfLines={1}>
                {cropName ? `${cropName} · ` : ""}{mandi.mandi}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel={t("a11y.close")}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
            {/* Mandi summary */}
            <View style={styles.summaryRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.summaryMandi, semi]}>{mandi.mandi}</Text>
                <Text style={[styles.summaryMeta, body]}>
                  {hasDistance
                    ? t("transportPlanner.distanceByRoad", { km: distanceKm })
                    : t("transportPlanner.distanceUnavailable")}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.summaryLabel, body]}>{t("transportPlanner.netAtGate")}</Text>
                <Text style={[styles.summaryNet, display, tabularNums]}>{rupee(mandi.netPrice)}/qtl</Text>
              </View>
            </View>

            {/* Weight input */}
            <View style={{ gap: space.xs }}>
              <Text style={[styles.label, semi]}>{t("transportPlanner.harvestQty")}</Text>
              <View style={styles.weightRow}>
                <TextInput
                  value={weightText}
                  onChangeText={setWeightText}
                  keyboardType="numeric"
                  style={[styles.weightInput, semi, tabularNums]}
                  placeholder="50"
                  placeholderTextColor={colors.textMuted}
                />
                <View style={styles.qtlTag}>
                  <Text style={[styles.qtlText, semi]}>{t("transportPlanner.quintals")}</Text>
                </View>
              </View>
              <Text style={[styles.hint, body]}>
                {t("transportPlanner.qtlNote", { qtl: weight, tonnes: (weight / 10).toFixed(1) })}
              </Text>
            </View>

            {/* Vehicle selection */}
            <View style={{ gap: space.xs }}>
              <Text style={[styles.label, semi]}>{t("transportPlanner.selectVehicle")}</Text>
              <Text style={[styles.hint, body]}>{t("transportPlanner.aiRecommends")}</Text>
              {vehiclesWithCost.map((v) => {
                const isSelected = v.id === activeVehicle.id;
                const isRec = v.id === recommended.id;
                return (
                  <Pressable
                    key={v.id}
                    onPress={() => setSelectedVehicleId(v.id)}
                    style={[styles.vehicle, isSelected && styles.vehicleSelected]}
                  >
                    <View style={styles.vehicleTop}>
                      <Text style={{ fontSize: 22 }}>{v.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.vehicleName, semi]}>{v.name}</Text>
                        <Text style={[styles.vehicleDesc, body]}>{t(v.descKey)}</Text>
                      </View>
                      {isRec && (
                        <View style={styles.recBadge}>
                          <Text style={[styles.recText, semi]}>{t("transportPlanner.recommended")}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.vehicleMetaRow}>
                      <View style={styles.pill}><Text style={[styles.pillText, body]}>{t("transportPlanner.cap", { n: v.capacity })}</Text></View>
                      <View style={styles.pill}><Text style={[styles.pillText, body]}>₹{v.ratePerKm}/km</Text></View>
                      {v.tripsNeeded > 1 && (
                        <View style={[styles.pill, styles.pillWarn]}>
                          <Text style={[styles.pillText, styles.pillWarnText, body]}>{t("transportPlanner.trips", { n: v.tripsNeeded })}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }} />
                      {hasDistance && <Text style={[styles.vehicleCost, semi, tabularNums]}>{rupee(v.totalCost)}</Text>}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Multi-trip warning */}
            {hasDistance && activeVehicle.tripsNeeded > 1 && (
              <View style={styles.warn}>
                <Ionicons name="warning" size={16} color={colors.attention} style={{ marginTop: 1 }} />
                <Text style={[styles.warnText, body]}>
                  {t("transportPlanner.overloadWarning", { weight, vehicle: activeVehicle.name, capacity: activeVehicle.capacity, trips: activeVehicle.tripsNeeded })}
                </Text>
              </View>
            )}

            {/* Invoice */}
            <View style={styles.invoice}>
              <Text style={[styles.invoiceLabel, semi]}>{t("transportPlanner.invoice")}</Text>
              <InvoiceRow label={t("transportPlanner.grossRevenue", { qty: weight, price: rupee(mandi.netPrice) })} value={rupee(grossRevenue)} />
              {hasDistance ? (
                <>
                  <InvoiceRow label={t("transportPlanner.distanceToMandi")} value={`${distanceKm} km${IS_ROUND_TRIP ? t("transportPlanner.roundTripSuffix") : ""}`} />
                  <InvoiceRow label={t("transportPlanner.transportRow", { vehicle: activeVehicle.name, trips: activeVehicle.tripsNeeded })} value={`-${rupee(activeVehicle.totalCost)}`} danger />
                </>
              ) : (
                <InvoiceRow label={t("transportPlanner.distanceUnavailable")} value="—" />
              )}
              <View style={styles.invoiceDivider} />
              <View style={styles.earnRow}>
                <Text style={[styles.earnLabel, semi]}>{t("transportPlanner.estimatedEarnings")}</Text>
                <Text style={[styles.earnValue, display, tabularNums]}>{rupee(finalEarnings)}</Text>
              </View>
            </View>

            <Pressable onPress={onClose} style={styles.confirm}>
              <Ionicons name="checkmark-circle" size={16} color={colors.onPrimary} />
              <Text style={[styles.confirmText, semi]}>{t("transportPlanner.confirmBook")}</Text>
            </Pressable>
            <Text style={[styles.advisory, body]}>{t("transportPlanner.advisory")}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function InvoiceRow({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  const { locale } = useT();
  return (
    <View style={styles.invoiceRow}>
      <Text style={[styles.invoiceRowLabel, { fontFamily: bodyFont(locale) }]}>{label}</Text>
      <Text style={[styles.invoiceRowValue, tabularNums, { fontFamily: bodyFont(locale, "semi") }, danger && { color: colors.danger }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim ?? "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%", overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 16, color: colors.text },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  closeBtn: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.surfaceSoft, alignItems: "center", justifyContent: "center" },
  summaryRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSoft, borderRadius: radius.card, padding: space.sm, gap: space.sm },
  summaryMandi: { fontSize: 14, color: colors.text },
  summaryMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  summaryLabel: { fontSize: 10, color: colors.textMuted, textTransform: "uppercase" },
  summaryNet: { fontSize: 16, color: colors.primary },
  label: { fontSize: 11, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  weightRow: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  weightInput: { flex: 1, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 15, color: colors.text },
  qtlTag: { backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, paddingHorizontal: space.md, paddingVertical: 12 },
  qtlText: { fontSize: 14, color: colors.text },
  hint: { fontSize: 11, color: colors.textMuted },
  vehicle: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, padding: space.sm, backgroundColor: colors.surface, gap: space.xs },
  vehicleSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceSoft },
  vehicleTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  vehicleName: { fontSize: 13, color: colors.text },
  vehicleDesc: { fontSize: 11, color: colors.textSecondary },
  recBadge: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  recText: { fontSize: 9, color: colors.onPrimary, textTransform: "uppercase", letterSpacing: 0.5 },
  vehicleMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  pill: { backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 10, color: colors.textSecondary },
  pillWarn: { backgroundColor: colors.surfaceSoft, borderColor: colors.attention },
  pillWarnText: { color: colors.attention },
  vehicleCost: { fontSize: 14, color: colors.text },
  warn: { flexDirection: "row", gap: space.sm, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.attention, borderRadius: radius.card, padding: space.sm },
  warnText: { flex: 1, fontSize: 12, color: colors.textSecondary },
  invoice: { backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, padding: space.md, gap: space.sm },
  invoiceLabel: { fontSize: 10, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  invoiceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  invoiceRowLabel: { flex: 1, fontSize: 12, color: colors.textSecondary, paddingRight: space.sm },
  invoiceRowValue: { fontSize: 13, color: colors.text },
  invoiceDivider: { height: 1, backgroundColor: colors.border },
  earnRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.card, padding: space.sm },
  earnLabel: { fontSize: 13, color: colors.text },
  earnValue: { fontSize: 18, color: colors.primary },
  confirm: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs, backgroundColor: colors.primary, borderRadius: radius.card, paddingVertical: 14 },
  confirmText: { fontSize: 14, color: colors.onPrimary },
  advisory: { fontSize: 11, color: colors.textMuted, textAlign: "center" },
});
