import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { consumeAuthRedirectSession } from "../utils/auth";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoggedIn: boolean | null;
  isLoading: boolean;
  authErrorMessage: string | null;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

  const applySession = useCallback((nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
  }, []);

  const refreshSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const {
        data: { session: nextSession },
      } = await supabase.auth.getSession();
      setAuthErrorMessage(null);
      applySession(nextSession);
    } finally {
      setIsLoading(false);
    }
  }, [applySession]);

  useEffect(() => {
    let isMounted = true;
    let bootstrapped = false;

    async function bootstrapSession() {
      try {
        const recoveredSession = await consumeAuthRedirectSession();
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!isMounted) return;
        setAuthErrorMessage(null);
        applySession(recoveredSession ?? currentSession);
      } catch (error) {
        console.error("Error restoring auth session:", error);

        if (!isMounted) return;
        setAuthErrorMessage(error instanceof Error ? error.message : "Nao foi possivel restaurar a sessao.");
        applySession(null);
      } finally {
        bootstrapped = true;
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void bootstrapSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (_event === "INITIAL_SESSION" && bootstrapped) {
        return;
      }

      if (nextSession || _event !== "INITIAL_SESSION") {
        setAuthErrorMessage(null);
      }
      applySession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    applySession(null);
  }, [applySession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isLoggedIn: isLoading ? null : Boolean(user),
      isLoading,
      authErrorMessage,
      refreshSession,
      signOut: handleSignOut,
    }),
    [authErrorMessage, handleSignOut, isLoading, refreshSession, session, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
