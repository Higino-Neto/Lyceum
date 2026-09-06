import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getMobileAuthErrorMessage, getMobileSupabase, subscribeMobileAuth, validateMobileSession } from "./supabaseMobile";
import { createMobileUserProfile } from "./readingApi";
export function useMobileAuth() {
  const queryClient = useQueryClient();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const invalidateAccountQueries = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["mobile-readings"] });
    void queryClient.invalidateQueries({ queryKey: ["mobile-reading-stats"] });
    void queryClient.invalidateQueries({ queryKey: ["mobile-ranking"] });
    void queryClient.invalidateQueries({ queryKey: ["mobile-friends"] });
    void queryClient.invalidateQueries({ queryKey: ["mobile-friend-requests"] });
    void queryClient.invalidateQueries({ queryKey: ["mobile-user-profile"] });
  }, [queryClient]);

  useEffect(() => {
    let cancelled = false;
    validateMobileSession()
      .then((session) => {
        if (!cancelled) setSessionEmail(session?.user?.email ?? null);
      })
      .catch((error) => {
        if (!cancelled) {
          setSessionEmail(null);
          setAuthError(getMobileAuthErrorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return subscribeMobileAuth((_event, session) => {
      setSessionEmail(session?.user?.email ?? null);
      setAuthReady(true);
      setAuthError(null);
      invalidateAccountQueries();
    });
  }, [invalidateAccountQueries]);

  const signIn = async (mode: "signin" | "signup") => {
    const supabase = getMobileSupabase();
    if (!supabase) {
      toast.error("Supabase nao configurado no build mobile");
      return;
    }

    const email = authEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(email) || !authPassword) {
      toast.error("Informe email e senha");
      return;
    }
    if (mode === "signup" && authPassword.length < 8) {
      toast.error("Use uma senha com pelo menos 8 caracteres");
      return;
    }

    setAuthBusy(true);
    setAuthError(null);

    try {
      const result = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password: authPassword })
        : await supabase.auth.signUp({
            email,
            password: authPassword,
            options: {
              data: {
                name: email.split("@")[0],
                full_name: email.split("@")[0],
              },
            },
          });

      if (result.error) throw result.error;

      if (result.data.session?.user?.id) {
        await createMobileUserProfile(result.data.user.id, result.data.user.email || email).catch((error) => {
          console.warn("[mobile-auth] profile bootstrap failed", error);
          toast("A sessao foi iniciada, mas o perfil social sera reparado na proxima sincronizacao.");
        });
      }

      if (!result.data.session) {
        setSessionEmail(null);
        setAuthPassword("");
        toast.success("Conta criada. Confirme o email antes de entrar.");
        return;
      }

      setSessionEmail(result.data.session.user.email ?? email);
      setAuthPassword("");
      invalidateAccountQueries();
      toast.success(mode === "signin" ? "Sessao iniciada" : "Conta criada");
    } catch (error) {
      const message = getMobileAuthErrorMessage(error);
      setAuthError(message);
      toast.error(message);
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    setAuthBusy(true);
    try {
      const { error } = await getMobileSupabase()?.auth.signOut() || { error: null };
      if (error) throw error;
      setSessionEmail(null);
      setAuthPassword("");
      queryClient.clear();
    } catch (error) {
      const message = getMobileAuthErrorMessage(error);
      setAuthError(message);
      toast.error(message);
    } finally {
      setAuthBusy(false);
    }
  };

  const requestPasswordReset = async () => {
    const supabase = getMobileSupabase();
    const email = authEmail.trim();
    if (!supabase || !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Informe o email da sua conta");
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    try {
      const redirectBase = String(import.meta.env.VITE_AUTH_REDIRECT_BASE_URL || "").trim().replace(/\/$/, "");
      const options = redirectBase.startsWith("https://")
        ? { redirectTo: `${redirectBase}/reset-password` }
        : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email, options);
      if (error) throw error;
      toast.success("Enviamos as instrucoes de recuperacao para o seu email.");
    } catch (error) {
      const message = getMobileAuthErrorMessage(error);
      setAuthError(message);
      toast.error(message);
    } finally {
      setAuthBusy(false);
    }
  };

  return { sessionEmail, authReady, authBusy, authError, authEmail, setAuthEmail, authPassword, setAuthPassword, signIn, signOut, requestPasswordReset };
}
