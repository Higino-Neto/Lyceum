import { supabase } from "../lib/supabase";
import { createUserProfile } from "../api/database";

export const MIN_PASSWORD_LENGTH = 8;

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

export function getAuthRedirectUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const configuredBaseUrl = import.meta.env.VITE_AUTH_REDIRECT_BASE_URL?.trim();

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
