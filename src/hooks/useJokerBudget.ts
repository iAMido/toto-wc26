import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface JokerBudget {
  /** Number of jokers currently marked (locked + future). */
  used: number;
  /** Remaining jokers (3 - used). */
  remaining: number;
  /** Set of match IDs where joker is active — used to determine
   *  "this match already has joker" so toggle stays enabled even at cap. */
  jokerMatchIds: Set<string>;
}

const JOKER_MAX = 3;

/**
 * Fetches the current user's joker usage across all predictions.
 * Cached app-wide via React Query; invalidate after every prediction mutation.
 *
 * Query key: ['joker-budget']
 */
export function useJokerBudget() {
  return useQuery<JokerBudget>({
    queryKey: ['joker-budget'],
    queryFn: async (): Promise<JokerBudget> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { used: 0, remaining: JOKER_MAX, jokerMatchIds: new Set() };
      }

      const { data, error } = await supabase
        .from('predictions')
        .select('match_id')
        .eq('user_id', user.id)
        .eq('joker_used', true);

      if (error) throw error;

      const ids = new Set((data ?? []).map((r) => r.match_id as string));
      const used = ids.size;

      return {
        used,
        remaining: Math.max(0, JOKER_MAX - used),
        jokerMatchIds: ids,
      };
    },
    staleTime: 30_000, // 30s — fresh enough for UI toggle state.
  });
}

/**
 * Call this after a successful prediction upsert to refresh joker counts
 * across all mounted components.
 */
export function useInvalidateJokerBudget() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['joker-budget'] });
}
