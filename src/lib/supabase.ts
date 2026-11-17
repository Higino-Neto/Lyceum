import { createClient, type SupabaseClient, type SupabaseClientOptions } from "@supabase/supabase-js";
import { translate } from "../i18n";
import { getPlatform, onPlatformChange } from "../platform";

const missingConfigError = new Error(
  "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before building Lyceum.",
);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export function getSupabaseConfig() {
  return isSupabaseConfigured && supabaseUrl && supabaseAnonKey
    ? { url: supabaseUrl, anonKey: supabaseAnonKey }
    : null;
}

function createDisabledQueryResult(data: unknown = null) {
  return { data, error: missingConfigError };
}

function createDisabledQueryBuilder(): unknown {
  const builder: unknown = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "then") {
          return (resolve: (value: unknown) => void, reject?: (reason: unknown) => void) =>
            Promise.resolve(createDisabledQueryResult()).then(resolve, reject);
        }

        return () => builder;
      },
    },
  );

  return builder;
}

function createDisabledSupabaseClient(): SupabaseClient {
  const authResult = async () => createDisabledQueryResult();

  return {
    auth: {
      getUser: authResult,
      signUp: authResult,
      signInWithPassword: authResult,
      resetPasswordForEmail: authResult,
      exchangeCodeForSession: authResult,
      verifyOtp: authResult,
      setSession: authResult,
      resend: authResult,
      updateUser: authResult,
      signOut: authResult,
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe: () => undefined,
          },
        },
      }),
    },
    from: () => createDisabledQueryBuilder(),
    rpc: async () => createDisabledQueryResult(),
    storage: {
      from: () => ({
        upload: async () => createDisabledQueryResult(),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    },
  } as unknown as SupabaseClient;
}

/**
 * Stricter, user-facing validation used by screens that explain why the account
 * is unavailable. Returns `null` when the build carries a usable configuration.
 */
export function getSupabaseConfigError(): string | null {
  if (!supabaseUrl || !supabaseAnonKey) return translate("mobile:auth.connectionMissing");
  try {
    const parsed = new URL(supabaseUrl);
    const localDevelopment = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !localDevelopment) return translate("mobile:auth.supabaseUrlHttps");
  } catch {
    return translate("mobile:auth.supabaseUrlInvalid");
  }
  if (supabaseAnonKey.length < 20) return translate("mobile:auth.supabaseKeyInvalid");
  return null;
}

let client: SupabaseClient | null = null;

// A platform registered after a client was created (tests, hot reload) must not
// keep a client wired to the previous session storage.
onPlatformChange(() => {
  client = null;
});

function buildClientOptions(): SupabaseClientOptions<"public"> {
  const platform = getPlatform();
  const auth: NonNullable<SupabaseClientOptions<"public">["auth"]> = { detectSessionInUrl: false };
  if (platform.authStorage) {
    auth.storage = platform.authStorage;
    auth.persistSession = true;
    auth.autoRefreshToken = true;
  }
  if (platform.authFlowType) auth.flowType = platform.authFlowType;
  const options: SupabaseClientOptions<"public"> = { auth };
  if (platform.clientInfo) options.global = { headers: { "X-Client-Info": platform.clientInfo } };
  return options;
}

/** The shared client, created on first use with the registered platform's options. */
export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const config = getSupabaseConfig();
    client = config
      ? createClient(config.url, config.anonKey, buildClientOptions())
      : createDisabledSupabaseClient();
  }
  return client;
}

/**
 * Lazy facade over `getSupabaseClient()`, so importing this module never creates
 * the client before the entry point has registered its platform services.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const target = getSupabaseClient();
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

export function resetSupabaseClientForTests() {
  client = null;
}
