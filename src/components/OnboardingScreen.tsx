import { colors as themeColors } from "@/theme/colors";
import { Fragment, useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/components/ui/Pressable";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/constants/colors";
import { cardShadow, topEdgeShadow } from "@/constants/effects";
import { locationLabel } from "@/lib/geocode";
import { createFarmerProfile } from "@/lib/onboarding";
import { PLANS, type Cycle, type PlanId } from "@/lib/plans";
import { supabase } from "@/lib/supabase";
import {
  normalizeEmail,
  normalizePhone,
  validateEmail,
  validatePhone,
} from "@/lib/validation";
import { useT } from "./i18n/LanguageProvider";
import { StepPlan } from "./onboarding/StepPlan";
import { StepProfile, type ProfileDraft } from "./onboarding/StepProfile";
import { themed } from "@/theme";

const STEPS = ["Profile", "Plan"] as const;
type Step = 0 | 1;

/**
 * Registration on the phone for the Platform Services app.
 *
 * This prototype provides the market, expenses, input-price, shop, news,
 * library and government-scheme tools, none of which need a field inventory —
 * they key off who the farmer is and where they are. So registration is the
 * profile (contact details and location) and the membership plan, and the
 * farm/crop steps of the full app are not part of this program.
 *
 * Registration is gated behind an account (AppShell only renders this for a
 * signed-in session with no farmer profile yet), so there is no auth step here.
 */
export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  // PLANS carries i18n keys, not literals, so the tier name needs resolving.
  const { t } = useT();
  const [step, setStep] = useState<Step>(0);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileDraft>({
    name: "",
    phone: "",
    email: "",
    location: undefined,
  });
  const [plan, setPlan] = useState<PlanId>("free");
  const [planCycle, setPlanCycle] = useState<Cycle>("annual");

  /**
   * The email comes from the account, not from the farmer a second time.
   *
   * Registration only ever runs for a signed-in session (the gate in
   * app/index.tsx guarantees it), so the address is already known and already
   * verified by the act of signing in. Only the blank is filled, so this can
   * never overwrite something they have typed.
   */
  useEffect(() => {
    let alive = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        const address = data.user?.email;
        if (!alive || !address) return;
        setProfile((p) => (p.email ? p : { ...p, email: address }));
      })
      .catch(() => {
        // Offline, or the session is mid-refresh. The field stays empty and
        // the farmer can type it — never a blocker.
      });
    return () => {
      alive = false;
    };
  }, []);

  const markTouched = (key: string) => setTouched((t) => ({ ...t, [key]: true }));
  const shown = (key: string, error: string | null) => (touched[key] ? error : null);

  const nameError = profile.name.trim() ? null : "Name is required.";
  const phoneError = validatePhone(profile.phone);
  const emailError = validateEmail(profile.email);

  const canLeaveProfile = Boolean(
    profile.name.trim() && !phoneError && !emailError && profile.location
  );

  async function handleFinish() {
    setSubmitting(true);
    setFailure(null);

    try {
      await createFarmerProfile({
        name: profile.name.trim(),
        // Stored as the bare ten digits, so "+91 98765 43210" and "9876543210"
        // end up as the same value on file.
        phone: normalizePhone(profile.phone),
        email: normalizeEmail(profile.email),
        location: profile.location,
        locationAddress: locationLabel(profile.location),
        plan,
        planCycle,
      });
      onDone();
    } catch (e: any) {
      setFailure(e?.message ?? "Could not save your registration. Please try again.");
      setSubmitting(false);
    }
  }

  function goBack() {
    setFailure(null);
    setStep((s) => (s === 0 ? 0 : ((s - 1) as Step)));
  }

  const primary = (() => {
    if (step === 0) {
      return {
        label: "Continue",
        disabled: !canLeaveProfile,
        onPress: () => {
          ["name", "phone", "email"].forEach(markTouched);
          if (canLeaveProfile) setStep(1);
        },
      };
    }
    return {
      label: submitting ? "Saving…" : "Finish registration",
      disabled: submitting,
      onPress: handleFinish,
    };
  })();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          {step > 0 ? (
            <Pressable style={styles.back} onPress={goBack} hitSlop={10}>
              <Ionicons name="chevron-back" size={22} color={colors.primary} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          ) : (
            <View style={styles.back} />
          )}
        </View>

        <View style={styles.stepper}>
          {STEPS.map((label, i) => (
            // The connector is a sibling of the step, not a child of it: only
            // then can it flex, and absorb whatever width the steps leave.
            <Fragment key={label}>
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepDot,
                    i === step && styles.stepDotActive,
                    i < step && styles.stepDotDone,
                  ]}
                >
                  {i < step ? (
                    <Ionicons name="checkmark" size={13} color={themeColors.onPrimary} />
                  ) : (
                    <Text style={[styles.stepNum, i === step && styles.stepNumActive]}>
                      {i + 1}
                    </Text>
                  )}
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.stepLabel, i === step && styles.stepLabelActive]}
                >
                  {label}
                </Text>
              </View>
              {i < STEPS.length - 1 && <View style={styles.stepLine} />}
            </Fragment>
          ))}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.kicker}>REGISTRATION</Text>
          <Text style={styles.title}>
            {step === 0 ? "About you" : "Choose your plan"}
          </Text>
          <Text style={styles.sub}>
            {step === 0
              ? "We need a way to reach you and where you are, so prices, news and schemes match your area."
              : "Start free and change it whenever you like — nothing is charged today."}
          </Text>

          {step === 0 && (
            <StepProfile
              value={profile}
              onChange={(patch) => setProfile((p) => ({ ...p, ...patch }))}
              onBlurField={markTouched}
              errors={{
                name: shown("name", nameError),
                phone: shown("phone", phoneError),
                email: shown("email", emailError),
              }}
            />
          )}

          {step === 1 && (
            <StepPlan
              plan={plan}
              cycle={planCycle}
              onCycleChange={setPlanCycle}
              onChoose={(nextPlan, nextCycle) => {
                setPlan(nextPlan);
                setPlanCycle(nextCycle);
              }}
            />
          )}

          {failure && (
            <View style={[styles.failure, cardShadow]}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.failureText}>{failure}</Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, topEdgeShadow]}>
          <Pressable
            style={[styles.cta, primary.disabled && styles.ctaOff]}
            onPress={primary.onPress}
            disabled={primary.disabled}
          >
            {submitting ? (
              <ActivityIndicator color={themeColors.onPrimary} />
            ) : (
              <Text style={styles.ctaText}>{primary.label}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = themed(() => StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, height: 36, justifyContent: "center" },
  back: { flexDirection: "row", alignItems: "center", gap: 2, height: 28 },
  backText: { fontSize: 15, fontWeight: "700", color: colors.primary },

  stepper: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 14,
    alignItems: "center",
  },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.sageLine,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: { borderColor: colors.primary },
  stepDotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepNum: { fontSize: 12, fontWeight: "800", color: colors.textFaint },
  stepNumActive: { color: colors.primary },
  stepLabel: { fontSize: 11, fontWeight: "700", color: colors.textFaint, flexShrink: 1 },
  stepLabelActive: { color: colors.ink },
  stepLine: {
    flex: 1,
    minWidth: 6,
    height: 1.5,
    backgroundColor: colors.sageLine,
    marginHorizontal: 5,
  },

  body: { paddingHorizontal: 20, paddingBottom: 32 },
  kicker: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: colors.leaf,
    marginBottom: 4,
  },
  title: { fontSize: 28, fontWeight: "800", color: colors.ink, marginBottom: 4 },
  sub: { fontSize: 15, color: colors.textFaint, marginBottom: 22, lineHeight: 20 },

  failure: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: colors.dangerBg,
    borderRadius: 16,
    padding: 14,
    marginTop: 18,
  },
  failureText: { flex: 1, fontSize: 13, color: colors.danger, lineHeight: 19 },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 22,
    backgroundColor: colors.surface,
  },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaOff: { opacity: 0.4 },
  ctaText: { color: themeColors.onPrimary, fontSize: 16, fontWeight: "800" },
}));
