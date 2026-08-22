import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import {
  createClient,
  type AuthChangeEvent,
  type Session,
  type SupabaseClient,
  type SupportedStorage,
} from "@supabase/supabase-js";

const AUTH_STORAGE_PREFIX = "lyceum.mobile.auth.";

let client: SupabaseClient | null = null;

function readConfig() {
  return {
    url: String(import.meta.env.VITE_SUPABASE_URL || "").trim(),
    anonKey: String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim(),
  };
}

export function getMobileSupabaseConfigError() {
  const { url, anonKey } = readConfig();
  if (!url || !anonKey) return "A conexao da conta nao foi incluida nesta versao do aplicativo.";
  try {
    const parsed = new URL(url);
    const localDevelopment = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !localDevelopment) return "A URL do Supabase precisa usar HTTPS.";
  } catch {
    return "A URL do Supabase e invalida.";
  }
  if (anonKey.length < 20) return "A chave publica do Supabase e invalida.";
  return null;
}

export function hasSupabaseConfig() {
  return getMobileSupabaseConfigError() === null;
}

const mobileAuthStorage: SupportedStorage = {
  async getItem(key) {
    const namespacedKey = `${AUTH_STORAGE_PREFIX}${key}`;
    if (Capacitor.isNativePlatform()) {
      const stored = (await Preferences.get({ key: namespacedKey })).value;
      if (stored) return stored;
      try {
        const legacy = localStorage.getItem(key);
        if (legacy) await Preferences.set({ key: namespacedKey, value: legacy });
        return legacy;
      } catch {
        return null;
      }
    }
    try {
      return localStorage.getItem(namespacedKey) || localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key, value) {
    const namespacedKey = `${AUTH_STORAGE_PREFIX}${key}`;
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key: namespacedKey, value });
      return;
    }
    localStorage.setItem(namespacedKey, value);
  },
  async removeItem(key) {
    const namespacedKey = `${AUTH_STORAGE_PREFIX}${key}`;
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key: namespacedKey });
      try { localStorage.removeItem(key); } catch { /* legacy WebView storage may be unavailable */ }
      return;
    }
    localStorage.removeItem(namespacedKey);
    localStorage.removeItem(key);
  },
};

export function getMobileSupabase() {
  if (!hasSupabaseConfig()) return null;
  if (!client) {
    const { url, anonKey } = readConfig();
    client = createClient(url, anonKey, {
      auth: {
        storage: mobileAuthStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
      global: {
        headers: { "X-Client-Info": `lyceum-mobile/${import.meta.env.VITE_APP_VERSION || "dev"}` },
      },
    });
  }
  return client;
}

export async function getMobileSession(): Promise<Session | null> {
  const supabase = getMobileSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function validateMobileSession(): Promise<Session | null> {
  const supabase = getMobileSupabase();
  if (!supabase) return null;
  const session = await getMobileSession();
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

export function subscribeMobileAuth(
  listener: (event: AuthChangeEvent, session: Session | null) => void,
) {
  const supabase = getMobileSupabase();
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange(listener);
  return () => data.subscription.unsubscribe();
}

export function getMobileAuthErrorMessage(error: unknown) {
  const raw = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : String(error || "");
  const message = raw.toLowerCase();
  if (message.includes("invalid login credentials")) return "Email ou senha incorretos.";
  if (message.includes("email not confirmed")) return "Confirme seu email antes de entrar.";
  if (message.includes("user already registered")) return "Ja existe uma conta com este email.";
  if (message.includes("password should be")) return "A senha nao atende aos requisitos de seguranca.";
  if (message.includes("failed to fetch") || message.includes("network")) return "Nao foi possivel conectar ao servidor. Verifique sua internet.";
  if (message.includes("rate limit")) return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  return raw || "Nao foi possivel concluir a autenticacao.";
}

export function resetMobileSupabaseForTests() {
  client = null;
}
