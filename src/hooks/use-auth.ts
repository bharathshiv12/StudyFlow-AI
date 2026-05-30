import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getSupabaseErrorMessage, withSupabaseTimeout } from "@/lib/supabase-network";
import { logConnectivityError } from "@/lib/network-diagnostics";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applySession = useCallback((nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
  }, []);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: sessionError } = await withSupabaseTimeout(
        supabase.auth.getSession(),
        "Loading your Supabase session",
      );

      if (sessionError) throw sessionError;
      applySession(data.session);
    } catch (sessionError) {
      applySession(null);
      logConnectivityError(sessionError);
      setError(getSupabaseErrorMessage(sessionError, "Unable to load your session."));
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | undefined;

    const setLiveSession = (nextSession: Session | null) => {
      if (!mounted) return;
      applySession(nextSession);
    };

    try {
      const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setLiveSession(nextSession);
        if (mounted) {
          setError(null);
          setLoading(false);
        }
      });
      subscription = sub.subscription;

      void withSupabaseTimeout(
        supabase.auth.getSession(),
        "Loading your Supabase session",
      )
        .then(({ data, error: sessionError }) => {
          if (sessionError) throw sessionError;
          setLiveSession(data.session);
        })
        .catch((sessionError) => {
          setLiveSession(null);
          logConnectivityError(sessionError);
          if (mounted) {
            setError(getSupabaseErrorMessage(sessionError, "Unable to load your session."));
          }
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    } catch (sessionError) {
      setLiveSession(null);
      logConnectivityError(sessionError);
      setError(getSupabaseErrorMessage(sessionError, "Unable to initialize Supabase auth."));
      setLoading(false);
    }

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [applySession]);

  const value = useMemo(
    () => ({ session, user, loading, error, refreshSession }),
    [session, user, loading, error, refreshSession],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

export function useRequireAuth() {
  const { user, loading, error } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);
  return { user, loading, error };
}
