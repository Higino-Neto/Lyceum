import { supabase } from "../lib/supabase";
import { createUserProfile } from "../api/database";
import type { Session } from "@supabase/supabase-js";

export const MIN_PASSWORD_LENGTH = 8;
export const DESKTOP_PASSWORD_RESET_REDIRECT_URL = "lyceum://auth/reset-password";

export interface PasswordRequirement {
  id: "length";
  label: string;
  met: boolean;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      id: "length",
      label: `Pelo menos ${MIN_PASSWORD_LENGTH} caracteres`,
      met: password.length >= MIN_PASSWORD_LENGTH,
    },
  ];
}

export function validatePasswordStrength(password: string): string | null {
  const requirements = getPasswordRequirements(password);

  if (!requirements.find((requirement) => requirement.id === "length")?.met) {
    return `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`;
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

  if (normalizedHash) {
    const hashQuery = normalizedHash.includes("?")
      ? normalizedHash.slice(normalizedHash.indexOf("?") + 1)
      : normalizedHash;

    if (hashQuery.includes("=")) {
      new URLSearchParams(hashQuery).forEach((value, key) => {
        params.set(key, value);
      });
    }
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

  return "Erro desconhecido";
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
    throw new Error(
      "O Lyceum abriu a tela de recuperacao, mas o link nao trouxe token_hash, code ou tokens de sessao.",
    );
  }

  if (tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    if (error) {
      throw new Error(`Supabase recusou o token de recuperacao: ${getAuthErrorMessage(error)}`);
    }
    if (!data.session) {
      throw new Error("Supabase validou o token de recuperacao, mas nao retornou sessao.");
    }
    clearAuthRedirectParamsFromUrl();
    return data.session;
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      throw new Error(`Supabase recusou o codigo de recuperacao: ${getAuthErrorMessage(error)}`);
    }
    if (!data.session) {
      throw new Error("Supabase validou o codigo de recuperacao, mas nao retornou sessao.");
    }
    clearAuthRedirectParamsFromUrl();
    return data.session;
  }

  if (accessToken || refreshToken) {
    if (!accessToken || !refreshToken) {
      throw new Error("O link de recuperacao trouxe tokens incompletos.");
    }

    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      throw new Error(`Supabase recusou os tokens de recuperacao: ${getAuthErrorMessage(error)}`);
    }
    if (!data.session) {
      throw new Error("Supabase aceitou os tokens de recuperacao, mas nao retornou sessao.");
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
