import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/**
 * Guard hook: redirects to /login if no session.
 * Returns the authenticated user, or null while loading.
 */
export function useRequireAuth(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check current session on mount.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        navigate('/login', { replace: true });
      }
      setLoading(false);
    });

    // Listen for auth state changes (sign-in via magic link, sign-out, etc.).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
          navigate('/login', { replace: true });
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  return { user, loading };
}
