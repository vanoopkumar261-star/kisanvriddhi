/**
 * Registration writes — the mobile counterpart of the web app's
 * `createFarmerProfile` in src/lib/db.ts.
 *
 * This prototype (Platform Services) registers a farmer profile only: the
 * market, expenses, news and scheme tools key off who the farmer is and where
 * they are, not off a field inventory, so the farm and crop-cycle writes of the
 * full app are not part of this program. RLS scopes every write to the
 * signed-in owner.
 */

import { supabase } from "./supabase";
import type { SelectedLocation } from "./geocode";
import type { Cycle, PlanId } from "./plans";

type ProfileInput = {
  name: string;
  phone: string;
  email: string;
  location?: SelectedLocation;
  locationAddress: string;
  plan?: PlanId;
  planCycle?: Cycle;
};

/**
 * One profile per account. If registration runs again, the existing profile is
 * reused rather than duplicated — same rule as the web app.
 */
export async function createFarmerProfile(profile: ProfileInput) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to create a profile.");

  const { data: existing } = await supabase
    .from("farmer_profiles")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  // The membership chosen at the plan step. Only written when registration
  // actually asked — an undefined plan must not quietly reset a farmer who
  // upgraded and then re-ran the wizard. `plan_cycle` is null on the free tier
  // because there is nothing being billed on a cycle.
  const planPatch = profile.plan
    ? {
        plan: profile.plan,
        plan_cycle: profile.plan === "free" ? null : (profile.planCycle ?? "annual"),
        plan_selected_at: new Date().toISOString(),
      }
    : {};

  if (existing) return existing;

  const { data, error } = await supabase
    .from("farmer_profiles")
    .insert([
      {
        owner_id: user.id,
        name: profile.name,
        phone: profile.phone,
        email: profile.email || user.email,
        house_lat: profile.location?.lat,
        house_lng: profile.location?.lng,
        house_address: profile.locationAddress,
        // The PIN rides in the preferences jsonb rather than its own column,
        // matching where the web app puts it so one account reads the same on
        // both clients.
        preferences: profile.location?.pincode
          ? { house_pincode: profile.location.pincode }
          : {},
        ...planPatch,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** True once this account has a farmer profile — i.e. registration is done. */
export async function hasFarmerProfile(): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("farmer_profiles")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  // The error was previously discarded, so a transient query failure returned
  // false — which the gate reads as "not registered" and marches an already
  // registered farmer back through onboarding. Throwing lets the caller tell
  // a real "no profile yet" apart from a lookup that did not happen.
  if (error) throw new Error(error.message);

  return Boolean(data);
}
