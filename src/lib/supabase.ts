import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

function createDisabledQueryBuilder(): any {
  let builder: any;

  builder = new Proxy(
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

export const supabase = getSupabaseConfig()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createDisabledSupabaseClient();
