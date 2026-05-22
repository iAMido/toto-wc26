import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true });

/**
 * App-wide auth provider. Sits inside <BrowserRouter> so it can call
 * `useNavigate`. Auth state is resolved once on mount, then updated
 * reactively via `onAuthStateChange` — page navigations never reset
 * `loading` back to true.
 *
 * display_name redirect is handled per-location inside the provider so
 * it re-checks whenever the user navigates (e.g. after /setup-profile).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef(navigate);
  navRef.current = navigate;

  // Track whether the initial session check has completed — once done,
  // subsequent navigations won't flash loading.
  const resolvedRef = useRef(false);

  // Memoised evaluate so it's stable across renders
  const evaluate = useCallback(async (session: { user: User } | null) => {
    if (!session?.user) {
      setState({ user: null, loading: false });
      resolvedRef.current = true;
      // Only redirect if not already on a public page
      const path = window.location.pathname;
      if (path !== '/login' && !path.startsWith('/join/')) {
        navRef.current('/login', { replace: true });
      }
      return;
    }

    setState({ user: session.user, loading: false });
    resolvedRef.current = true;
  }, []);

  // One-time session bootstrap + auth listener
  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!cancelled) evaluate(session as { user: User } | null);
      })
      .catch(() => {
        if (!cancelled) {
          setState({ user: null, loading: false });
          resolvedRef.current = true;
        }
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!cancelled) evaluate(session as { user: User } | null);
      },
    );

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [evaluate]);

  // display_name guard — runs on every navigation, but only AFTER
  // auth has resolved (so it never blocks loading).
  useEffect(() => {
    if (!resolvedRef.current || !state.user) return;

    const path = location.pathname;
    const skip = path === '/login'
      || path === '/setup-profile'
      || path.startsWith('/join/');
    if (skip) return;

    const userId = state.user.id;
    let cancelled = false;
    (async () => {
      try {
        const { data: row } = await supabase
          .from('users')
          .select('display_name')
          .eq('id', userId)
          .maybeSingle();
        if (!cancelled && !row?.display_name) {
          navRef.current('/setup-profile', { replace: true });
        }
      } catch {
        // don't block
      }
    })();

    return () => { cancelled = true; };
  }, [location.pathname, state.user]);

  return (
    <AuthContext.Provider value={state}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Drop-in replacement for the old `useRequireAuth` hook.
 * Now just reads from the context — zero async work, zero re-mount delay.
 */
export function useAuthContext(): AuthState {
  return useContext(AuthContext);
}
