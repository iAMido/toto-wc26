import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/**
 * Guard hook for protected pages. Three states:
 *   - No session       → redirect to /login
 *   - Session, no name → redirect to /setup-profile (mandatory)
 *   - Session, with name → return user
 *
 * The display_name redirect is skipped on /setup-profile itself, /login, and
 * /join/:code (deep-link landing pages handle their own routing).
 *
 * IMPORTANT: `navigate` is intentionally NOT in the dependency array because
 * React Router guarantees its identity is stable. Including it caused re-render
 * cascades that made the effect restart before the async evaluate() completed,
 * leaving `loading` stuck at true on subsequent page mounts.
 */
export function useRequireAuth(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Stable ref so the evaluate closure always sees the latest navigate without
  // it being in the dependency array.
  const navRef = useRef(navigate);
  navRef.current = navigate;

  useEffect(() => {
    let cancelled = false;

    const pathSkipsDisplayCheck =
      location.pathname === '/login'
      || location.pathname === '/setup-profile'
      || location.pathname.startsWith('/join/');

    const evaluate = async (session: { user: User } | null) => {
      if (cancelled) return;
      if (!session?.user) {
        setUser(null);
        navRef.current('/login', { replace: true });
        setLoading(false);
        return;
      }

      setUser(session.user);

      if (!pathSkipsDisplayCheck) {
        try {
          const { data: row } = await supabase
            .from('users')
            .select('display_name')
            .eq('id', session.user.id)
            .maybeSingle();
          if (cancelled) return;
          if (!row?.display_name) {
            navRef.current('/setup-profile', { replace: true });
          }
        } catch {
          // Query failed — don't block the user, just skip the display_name check.
          if (cancelled) return;
        }
      }
      setLoading(false);
    };

    // Initial session check — with .catch so a rejected promise never leaves
    // loading stuck at true.
    supabase.auth.getSession()
      .then(({ data: { session } }) => evaluate(session as { user: User } | null))
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          navRef.current('/login', { replace: true });
          setLoading(false);
        }
      });

    // React to magic-link return / sign-out in the same tab
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => evaluate(session as { user: User } | null),
    );

    return () => { cancelled = true; subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return { user, loading };
}
