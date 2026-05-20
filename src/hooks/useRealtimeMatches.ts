import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const FINISHED = new Set(['FT', 'AET', 'PEN']);

/**
 * Subscribe to real-time UPDATE events on the `matches` table.
 *
 * When a match finishes (status → FT / AET / PEN) the scoring trigger
 * runs server-side and writes points to `predictions`.  This hook
 * invalidates the React Query caches that depend on match state so the
 * UI re-renders within ~1s of the DB change.
 *
 * Safe to call in multiple components — Supabase deduplicates channels
 * by name, and React Query deduplicates invalidation by key.
 */
export function useRealtimeMatches() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('realtime-matches')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches' },
        (payload) => {
          const matchId: string | undefined = payload.new?.id;
          const status: string | undefined = payload.new?.status;

          // Always refresh the match list on any status/score change.
          queryClient.invalidateQueries({ queryKey: ['matches'] });

          if (matchId) {
            queryClient.invalidateQueries({ queryKey: ['match', matchId] });
          }

          // When a match finishes, scoring trigger writes points →
          // invalidate leaderboard, predictions, and group feed caches.
          if (status && FINISHED.has(status)) {
            queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
            queryClient.invalidateQueries({ queryKey: ['my-predictions'] });
            queryClient.invalidateQueries({ queryKey: ['group-feed'] });

            if (matchId) {
              queryClient.invalidateQueries({
                queryKey: ['prediction', matchId],
              });
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
