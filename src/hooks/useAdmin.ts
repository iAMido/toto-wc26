import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Tells you whether the currently-authenticated user has the is_admin flag
 * set on public.users. Result is cached for the session (staleTime: Infinity)
 * — admin status doesn't change at runtime.
 *
 * Returns { isAdmin: boolean, isLoading: boolean }.
 */
export function useAdmin() {
  const { data, isLoading } = useQuery({
    queryKey: ['is-admin'],
    queryFn: async (): Promise<boolean> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data: row, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();
      if (error) return false;
      return !!row?.is_admin;
    },
    staleTime: Infinity,
  });
  return { isAdmin: !!data, isLoading };
}
