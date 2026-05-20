import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRealtimeMatches } from '@/hooks/useRealtimeMatches';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import GroupMatchFeed from '@/components/GroupMatchFeed';

export default function GroupDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useRequireAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [codeCopied, setCodeCopied] = useState(false);

  useRealtimeMatches();

  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ['group', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['group-members', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_members')
        .select('user_id, joined_at, users(id, display_name)')
        .eq('group_id', id!)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  const { data: leaderboard } = useQuery({
    queryKey: ['leaderboard', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_group_leaderboard')
        .select('*')
        .eq('group_id', id!)
        .order('total_points', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  const leaveGroup = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', id!)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      navigate('/groups');
    },
  });

  const copyInviteCode = async () => {
    if (!group) return;
    try {
      await navigator.clipboard.writeText(group.invite_code);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = group.invite_code;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  if (authLoading || groupLoading || membersLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="text-center space-y-2">
          <span className="text-3xl">👥</span>
          <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-[100dvh] p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{t('common.error')}</p>
        <Link to="/groups">
          <Button variant="outline">{t('common.back')}</Button>
        </Link>
      </div>
    );
  }

  const isCreator = group.created_by === user?.id;

  return (
    <div className="min-h-[100dvh]">
      <div className="max-w-lg mx-auto px-4 pb-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pt-4">
          <Link to="/groups" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← {t('common.back')}
          </Link>
        </div>

        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl mx-auto mb-2">
            {group.name[0]?.toUpperCase() ?? '?'}
          </div>
          <h1 className="text-xl font-bold">{group.name}</h1>
        </div>

        {/* Invite Code */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{t('groups.inviteCode')}</p>
              <p className="text-2xl font-mono font-bold tracking-widest text-primary">
                {group.invite_code}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={copyInviteCode} className="rounded-xl">
              {codeCopied ? t('groups.copied') : t('groups.shareCode')}
            </Button>
          </div>
        </div>

        {/* Match Feed */}
        {user && <GroupMatchFeed groupId={id!} userId={user.id} />}

        {/* ====== FULL LEADERBOARD ====== */}
        {/* Always render the table when there are members, even before any
            scoring has happened — gives users a sense of who's in the group. */}
        {leaderboard && leaderboard.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-3 space-y-3">
            <h2 className="font-bold text-sm text-center">🏅 {t('leaderboard.title')}</h2>

            {/* Sort by total_points DESC (the view already orders, but apply locally for safety) */}
            {(() => {
              const sorted = [...leaderboard].sort(
                (a, b) => (b.total_points ?? 0) - (a.total_points ?? 0),
              );
              const allZero = sorted.every((r) => (r.total_points ?? 0) === 0);
              return (
                <>
                  {/* Header row */}
                  <div className="grid grid-cols-[2rem_1fr_3rem_3rem_2.5rem_3rem] gap-1 text-[10px] font-bold text-muted-foreground border-b border-border pb-2 uppercase tracking-wider">
                    <span className="text-center">{t('leaderboard.rank')}</span>
                    <span className="ps-1">{t('leaderboard.player')}</span>
                    <span className="text-center" title={t('leaderboard.matchPoints')}>{t('leaderboard.matchPoints')}</span>
                    <span className="text-center" title={t('leaderboard.tournamentPoints')}>{t('leaderboard.tournamentPoints')}</span>
                    <span className="text-center" title={t('leaderboard.exactScores')}>{t('leaderboard.exactScores')}</span>
                    <span className="text-center font-extrabold text-primary">{t('leaderboard.totalPoints')}</span>
                  </div>

                  {/* Body rows */}
                  <div className="space-y-1">
                    {sorted.map((row, i) => {
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
                            {isMe && <span className="ms-1.5 text-[9px] text-primary font-bold">({t('leaderboard.you')})</span>}
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

                  {allZero && (
                    <p className="text-[11px] text-muted-foreground text-center pt-2 border-t border-border/50">
                      {t('leaderboard.noResultsYet')}
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Members */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="font-bold text-sm">
            {t('groups.members')} ({members?.length ?? 0})
          </h2>
          <ul className="space-y-2">
            {members?.map((m) => {
              const u = m.users as unknown as {
                id: string;
                display_name: string | null;
              };
              const name = u?.display_name || m.user_id.slice(0, 8);
              const initial = (u?.display_name ?? '?')[0].toUpperCase();
              return (
                <li key={m.user_id} className="flex items-center gap-3 text-sm">
                  <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold shrink-0 text-primary">
                    {initial}
                  </span>
                  <span className={m.user_id === user?.id ? 'font-semibold' : ''}>
                    {name}
                  </span>
                  {group.created_by === m.user_id && (
                    <span className="text-xs text-muted-foreground ms-auto">
                      {t('groups.creator')}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Leave Group */}
        {!isCreator && (
          <div className="text-center pt-2 pb-4">
            <button
              onClick={() => {
                if (window.confirm(t('groups.leaveConfirm'))) {
                  leaveGroup.mutate();
                }
              }}
              className="text-sm text-destructive hover:text-destructive/80 transition-colors"
              disabled={leaveGroup.isPending}
            >
              {t('groups.leaveGroup')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
