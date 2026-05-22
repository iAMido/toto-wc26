import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRealtimeMatches } from '@/hooks/useRealtimeMatches';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import Chevron from '@/components/Chevron';

/**
 * Dedicated standings hub: one tab per group the user belongs to, each
 * showing the full v_group_leaderboard table (Rank | Player | Match |
 * Tournament | Exact | Total). Realtime invalidation already in place via
 * useRealtimeMatches → react-query refetch.
 */
export default function LeaderboardsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user, loading: authLoading } = useRequireAuth();
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  useRealtimeMatches();

  /* ---------- user's groups ---------- */

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ['my-groups', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_members')
        .select('group_id, joined_at, groups(id, name)')
        .eq('user_id', user!.id)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((m) => {
        const g = m.groups as unknown as { id: string; name: string };
        return { id: g.id, name: g.name };
      });
    },
    enabled: !!user,
  });

  // Auto-select the first group once groups load
  useEffect(() => {
    if (groups && groups.length > 0 && !activeGroupId) {
      setActiveGroupId(groups[0].id);
    }
  }, [groups, activeGroupId]);

  /* ---------- selected group's leaderboard ---------- */

  const { data: leaderboard, isLoading: lbLoading } = useQuery({
    queryKey: ['leaderboard', activeGroupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_group_leaderboard')
        .select('*')
        .eq('group_id', activeGroupId!)
        .order('total_points', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeGroupId,
  });

  /* ---------- render ---------- */

  if (authLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="text-center space-y-2">
          <span className="text-3xl">🏅</span>
          <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh]">
      <div className="max-w-lg mx-auto px-4 pb-4 space-y-4">
        {/* Header */}
        <div className="text-center pt-6 pb-1">
          <h1 className="text-xl font-bold">🏅 {t('leaderboard.title')}</h1>
          <p className="text-xs text-muted-foreground mt-1">{t('leaderboard.subtitle')}</p>
        </div>

        {/* Empty-state when user is in no groups */}
        {!groupsLoading && (!groups || groups.length === 0) && (
          <div className="bg-card rounded-2xl border border-border p-6 text-center space-y-3">
            <span className="text-4xl block">👥</span>
            <p className="text-sm font-medium">
              {lang === 'he' ? 'עדיין לא הצטרפת לאף קבוצה' : "You're not in any groups yet"}
            </p>
            <p className="text-xs text-muted-foreground">
              {lang === 'he' ? 'צור קבוצה או הצטרף עם קוד הזמנה כדי לראות טבלאות דירוג.' : 'Create or join a group to see standings.'}
            </p>
            <Link to="/groups">
              <Button className="rounded-xl">{t('groups.title')}</Button>
            </Link>
          </div>
        )}

        {/* Group tabs */}
        {groups && groups.length > 0 && (
          <div
            className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
            role="tablist"
            aria-label={t('leaderboard.title')}
          >
            {groups.map((g) => {
              const active = g.id === activeGroupId;
              return (
                <button
                  key={g.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveGroupId(g.id)}
                  className={`
                    shrink-0 h-10 px-4 rounded-xl text-sm font-bold transition-all
                    ${active
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted/60 active:scale-95'}
                  `}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Standings table for active group */}
        {groups && groups.length > 0 && activeGroupId && (
          <>
            {lbLoading ? (
              <div className="skeleton-card p-4 space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton h-10 rounded-lg" />
                ))}
              </div>
            ) : leaderboard && leaderboard.length > 0 ? (
              <div className="bg-card rounded-2xl border border-border p-3 space-y-3">
                {/* Header row */}
                <div className="grid grid-cols-[2rem_1fr_3rem_3rem_2.5rem_3rem] gap-1 text-[10px] font-bold text-muted-foreground border-b border-border pb-2 uppercase tracking-wider">
                  <span className="text-center">{t('leaderboard.rank')}</span>
                  <span className="ps-1">{t('leaderboard.player')}</span>
                  <span className="text-center">{t('leaderboard.matchPoints')}</span>
                  <span className="text-center">{t('leaderboard.tournamentPoints')}</span>
                  <span className="text-center">{t('leaderboard.exactScores')}</span>
                  <span className="text-center font-extrabold text-primary">{t('leaderboard.totalPoints')}</span>
                </div>

                {/* Body */}
                <div className="space-y-1">
                  {[...leaderboard]
                    .sort((a, b) => (b.total_points ?? 0) - (a.total_points ?? 0))
                    .map((row, i) => {
                      const isMe = row.user_id === user?.id;
                      const rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
                      return (
                        <div
                          key={row.user_id}
                          className={`grid grid-cols-[2rem_1fr_3rem_3rem_2.5rem_3rem] gap-1 items-center py-2 px-1 rounded-lg tabular-nums ${
                            isMe ? 'bg-primary/15 border border-primary/30 shadow-sm' : ''
                          }`}
                        >
                          <span className="text-center text-sm font-black">{rankIcon}</span>
                          <span className="ps-1 text-sm truncate font-semibold">
                            {row.display_name || '—'}
                            {isMe && (
                              <span className="ms-1.5 text-[9px] text-primary font-bold">
                                ({t('leaderboard.you')})
                              </span>
                            )}
                          </span>
                          <span className="text-center text-xs font-bold">{row.match_points ?? 0}</span>
                          <span className={`text-center text-xs ${row.tournament_points ? 'font-bold text-amber-400' : 'text-muted-foreground/50'}`}>
                            {row.tournament_points ?? 0}
                          </span>
                          <span className="text-center text-xs text-emerald-400 font-medium">{row.exact_scores ?? 0}</span>
                          <span className="text-center text-base font-black text-primary">
                            {row.total_points ?? 0}
                          </span>
                        </div>
                      );
                    })}
                </div>

                {/* All-zero hint */}
                {leaderboard.every((r) => (r.total_points ?? 0) === 0) && (
                  <p className="text-[11px] text-muted-foreground text-center pt-2 border-t border-border/50">
                    {t('leaderboard.noResultsYet')}
                  </p>
                )}

                {/* Open group link */}
                <div className="text-center pt-1">
                  <Link
                    to={`/groups/${activeGroupId}`}
                    className="text-[11px] text-primary hover:underline"
                  >
                    {lang === 'he' ? 'פתח את עמוד הקבוצה' : 'Open group page'} <Chevron direction="forward" className="inline" />
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">{t('common.noData')}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
