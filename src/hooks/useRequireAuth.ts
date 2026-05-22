import { useAuthContext } from '@/contexts/AuthContext';
import type { User } from '@supabase/supabase-js';

/**
 * Thin wrapper that re-exports the app-wide auth state from AuthProvider.
 * All pages that call this hook now get instant access to cached auth —
 * no per-page async getSession(), no flash of loading skeleton on navigate.
 */
export function useRequireAuth(): { user: User | null; loading: boolean } {
  return useAuthContext();
}
