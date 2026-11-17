import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { translate } from "../i18n";
import { getSupabaseConfigError, supabase } from "./supabase";

/** True when the build has a usable Supabase configuration. */
export function hasSupabaseConfig() {
  return getSupabaseConfigError() === null;
}

export async function getCurrentSession(): Promise<Session | null> {
  if (!hasSupabaseConfig()) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/**
 * Returns the stored session only if it is still valid on the server, refreshing
 * it when it is about to expire. Used at startup so a revoked session never shows
 * the app as signed in.
 */
export async function validateSession(): Promise<Session | null> {
  const session = await getCurrentSession();
  if (!session) return null;

  const expiresSoon = !session.expires_at || session.expires_at * 1000 - Date.now() < 60_000;
  if (expiresSoon) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    return data.session;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user ? session : null;
}

export function subscribeAuth(listener: (event: AuthChangeEvent, session: Session | null) => void) {
  if (!hasSupabaseConfig()) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange(listener);
  return () => data.subscription.unsubscribe();
}

/** Turns Supabase and network failures into messages the user can act on. */
export function getAuthErrorMessage(error: unknown) {
  const raw = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : String(error || "");
  const message = raw.toLowerCase();
  if (message.includes("invalid login credentials")) return translate("mobile:auth.wrongCredentials");
  if (message.includes("email not confirmed")) return translate("mobile:auth.emailNotConfirmed");
  if (message.includes("user already registered")) return translate("mobile:auth.emailAlreadyRegistered");
  if (message.includes("password should be")) return translate("mobile:auth.passwordWeak");
  if (message.includes("failed to fetch") || message.includes("network")) return translate("mobile:auth.networkFailed");
  if (message.includes("rate limit")) return translate("mobile:auth.rateLimited");
  return raw || translate("mobile:auth.signInFailed");
}
