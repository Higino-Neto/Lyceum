import { supabase } from "../lib/supabase";
import { createUserProfile } from "../api/database";
import type { Session } from "@supabase/supabase-js";
import { translate, type TranslationKey } from "../i18n";

export const MIN_PASSWORD_LENGTH = 8;
export const DESKTOP_PASSWORD_RESET_REDIRECT_URL = "lyceum://auth/reset-password";

export interface PasswordRequirement {
  id: "length";
  labelKey: TranslationKey;
  values: Record<string, string | number>;
  met: boolean;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      id: "length",
      labelKey: "auth:password.requirements.minLength",
      values: { count: MIN_PASSWORD_LENGTH },
      met: password.length >= MIN_PASSWORD_LENGTH,
    },
  ];
}

/**
 * Returns the translation key describing why the password is too weak, or
 * `null` when it is acceptable. Callers translate the key so the message
 * follows the active language.
 */
export function validatePasswordStrength(
  password: string,
): { key: TranslationKey; values: Record<string, string | number> } | null {
  const requirements = getPasswordRequirements(password);
  const length = requirements.find((requirement) => requirement.id === "length");

  if (!length?.met) {
    return { key: "auth:password.errors.tooShort", values: length?.values ?? {} };
  }

  return null;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function isElectronRenderer() {
  return typeof window !== "undefined" && Boolean(window.api?.windowMinimize);
}

export function getAuthRedirectUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const configuredBaseUrl = import.meta.env.VITE_AUTH_REDIRECT_BASE_URL?.trim();

  if (
    normalizedPath === "/reset-password" &&
    isElectronRenderer() &&
    !import.meta.env.DEV
  ) {
    return DESKTOP_PASSWORD_RESET_REDIRECT_URL;
  }

  if (configuredBaseUrl) {
    return `${normalizeBaseUrl(configuredBaseUrl)}${normalizedPath}`;
  }

  if (typeof window === "undefined") {
    return normalizedPath;
  }

  const { hash, origin, pathname } = window.location;
  const pageUrl = `${origin}${pathname}`;
  const usesHashRouter = hash.startsWith("#/") || !import.meta.env.DEV;

  if (usesHashRouter) {
    return `${pageUrl}#${normalizedPath}`;
  }

  return `${origin}${normalizedPath}`;
}

export function parseAuthRedirectParams(search = "", hash = "") {
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  const normalizedHash = hash.replace(/^#/, "");

  function appendParams(query: string) {
    if (!query.includes("=")) return;

    new URLSearchParams(query).forEach((value, key) => {
      params.set(key, value);
    });
  }

  if (normalizedHash.includes("?")) {
    appendParams(normalizedHash.slice(normalizedHash.indexOf("?") + 1));
  }

  if (normalizedHash.includes("#")) {
    appendParams(normalizedHash.slice(normalizedHash.indexOf("#") + 1));
  } else if (normalizedHash && !normalizedHash.includes("/")) {
    appendParams(normalizedHash);
  }

  return params;
}

async function getElectronAuthDeepLinkParams() {
  if (typeof window === "undefined") return null;

  try {
    const consumeParams = window.api?.consumeAuthDeepLinkParams;
    if (typeof consumeParams !== "function") return null;

    const params = await consumeParams();
    if (!params || typeof params !== "object") return null;

    return params as Record<string, string>;
  } catch (error) {
    console.error("Error reading auth deep link params:", error);
    return null;
  }
}

function mergeAuthRedirectParams(
  params: URLSearchParams,
  fallbackParams: Record<string, string> | null,
) {
  Object.entries(fallbackParams ?? {}).forEach(([key, value]) => {
    if (value && !params.has(key)) {
      params.set(key, value);
    }
  });

  return params;
}

function clearAuthRedirectParamsFromUrl() {
  if (typeof window === "undefined" || !window.history?.replaceState) return;

  const resetRoute = window.location.hash.startsWith("#/")
    ? "#/reset-password"
    : import.meta.env.DEV
      ? "/reset-password"
      : "#/reset-password";
  window.history.replaceState(null, document.title, resetRoute);
}

function isResetPasswordRoute() {
  if (typeof window === "undefined") return false;

  return (
    window.location.pathname === "/reset-password" ||
    window.location.hash.startsWith("#/reset-password")
  );
}

function getAuthErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) {
      return message;
    }
  }

  return translate("auth:errors.unknown");
}

export async function consumeAuthRedirectSession(): Promise<Session | null> {
  if (typeof window === "undefined") return null;

  const params = mergeAuthRedirectParams(
    parseAuthRedirectParams(window.location.search, window.location.hash),
    await getElectronAuthDeepLinkParams(),
  );
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const hasAnyRecoveryParam = Boolean(code || tokenHash || accessToken || refreshToken);

  if (isResetPasswordRoute() && !hasAnyRecoveryParam) {
    throw new Error(translate("auth:errors.recoveryLinkMissingParams"));
  }

  if (tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    if (error) {
      throw new Error(
        translate("auth:errors.recoveryTokenRejected", {
          reason: getAuthErrorMessage(error),
        }),
      );
    }
    if (!data.session) {
      throw new Error(translate("auth:errors.recoveryTokenWithoutSession"));
    }
    clearAuthRedirectParamsFromUrl();
    return data.session;
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      throw new Error(
        translate("auth:errors.recoveryCodeRejected", {
          reason: getAuthErrorMessage(error),
        }),
      );
    }
    if (!data.session) {
      throw new Error(translate("auth:errors.recoveryCodeWithoutSession"));
    }
    clearAuthRedirectParamsFromUrl();
    return data.session;
  }

  if (accessToken || refreshToken) {
    if (!accessToken || !refreshToken) {
      throw new Error(translate("auth:errors.recoveryIncompleteTokens"));
    }

    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      throw new Error(
        translate("auth:errors.recoveryTokensRejected", {
          reason: getAuthErrorMessage(error),
        }),
      );
    }
    if (!data.session) {
      throw new Error(translate("auth:errors.recoveryTokensWithoutSession"));
    }
    clearAuthRedirectParamsFromUrl();
    return data.session;
  }

  return null;
}

async function ensureUserProfile(userId?: string, email?: string | null) {
  if (!userId || !email) return;

  try {
    await createUserProfile(userId, email);
  } catch (profileError) {
    console.error("Error creating profile:", profileError);
  }
}

export async function signUp(email: string, password: string, name?: string) {
  const normalizedEmail = normalizeEmail(email);
  const displayName = name?.trim() || normalizedEmail.split("@")[0];
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo: getAuthRedirectUrl("/signin"),
      data: {
        name: displayName,
        full_name: displayName,
      },
    },
  });

  if (error) {
    console.error(error);
    return { error };
  }

  if (data.session?.user) {
    await ensureUserProfile(data.session.user.id, data.session.user.email);
  }

  return {
    error: null,
    needsEmailConfirmation: Boolean(data.user && !data.session),
  };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });
  if (error) throw error;

  if (data.user) {
    await ensureUserProfile(data.user.id, data.user.email);
  }

  return data.user;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo: getAuthRedirectUrl("/reset-password"),
  });

  if (error) throw error;
}

export async function resendSignupConfirmation(email: string) {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: normalizeEmail(email),
    options: {
      emailRedirectTo: getAuthRedirectUrl("/signin"),
    },
  });

  if (error) throw error;
}

export async function updateAccountPassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
}
