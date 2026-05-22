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

  // Track whether display_name has been confirmed at least once, so we
  // don't re-check on every auth metadata update (updateUser triggers
  // onAuthStateChange → user reference changes → effect re-fires).
  const displayNameConfirmedRef = useRef(false);

  // Memoised evaluate so it's stable across renders
  const evaluate = useCallback(
    (event: string, session: { user: User } | null) => {
      // USER_UPDATED is fired when updateUser() changes metadata (e.g.
      // display_name edit on the profile page). The session is still valid —
      // just update the user object, never redirect.
      if (event === 'USER_UPDATED' && session?.user) {
        setState({ user: session.user, loading: false });
        return;
      }

      if (!session?.user) {
        // Only redirect to login on actual sign-out, not on transient states.
        // TOKEN_REFRESHED with null session means the refresh failed —
        // treat it the same as sign-out.
        setState({ user: null, loading: false });
        resolvedRef.current = true;
        displayNameConfirmedRef.current = false;
        const path = window.location.pathname;
        if (path !== '/login' && !path.startsWith('/join/')) {
          navRef.current('/login', { replace: true });
        }
        return;
      }

      setState({ user: session.user, loading: false });
      resolvedRef.current = true;
    },
    [],
  );

  // One-time session bootstrap + auth listener
  useEffect(() => {
    let cancelled = false;

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!cancelled) evaluate('INITIAL_SESSION', session as { user: User } | null);
      })
      .catch(() => {
        if (!cancelled) {
          setState({ user: null, loading: false });
          resolvedRef.current = true;
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!cancelled) evaluate(event, session as { user: User } | null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [evaluate]);

  // display_name guard — runs on navigation changes only (NOT on user
  // object changes). Once confirmed, stays confirmed until sign-out.
  useEffect(() => {
    if (!resolvedRef.current || !state.user) return;
    // Already confirmed they have a display_name — skip the DB query.
    if (displayNameConfirmedRef.current) return;

    const path = location.pathname;
    const skip =
      path === '/login' || path === '/setup-profile' || path.startsWith('/join/');
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
        if (cancelled) return;
        if (!row?.display_name) {
          navRef.current('/setup-profile', { replace: true });
        } else {
          // Name confirmed — don't re-check on every auth event.
          displayNameConfirmedRef.current = true;
        }
      } catch {
        // don't block — assume name exists rather than breaking the app
        if (!cancelled) displayNameConfirmedRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
    // Only re-run when the route changes, NOT when the user object
    // reference changes (which happens on every updateUser call).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

/**
 * Drop-in replacement for the old `useRequireAuth` hook.
 * Now just reads from the context — zero async work, zero re-mount delay.
 */
export function useAuthContext(): AuthState {
  return useContext(AuthContext);
}
