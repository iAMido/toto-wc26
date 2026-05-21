import { useEffect, useState } from 'react';
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
 */
export function useRequireAuth(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

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
        navigate('/login', { replace: true });
        setLoading(false);
        return;
      }

      setUser(session.user);

      if (!pathSkipsDisplayCheck) {
        // Single targeted query; cheap and uses 'maybeSingle' so missing row
        // (eg. during the brief window before the auth-trigger fires) is OK.
        const { data: row } = await supabase
          .from('users')
          .select('display_name')
          .eq('id', session.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (!row?.display_name) {
          navigate('/setup-profile', { replace: true });
        }
      }
      setLoading(false);
    };

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => evaluate(session as { user: User } | null));

    // React to magic-link return / sign-out in the same tab
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => evaluate(session as { user: User } | null),
    );

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [navigate, location.pathname]);

  return { user, loading };
}
