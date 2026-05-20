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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <span className="text-3xl">👥</span>
          <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{t('common.error')}</p>
        <Link to="/groups">
          <Button variant="outline">{t('common.back')}</Button>
        </Link>
      </div>
    );
  }

  const isCreator = group.created_by === user?.id;

  return (
    <div className="min-h-screen">
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

        {/* Leaderboard */}
        {leaderboard && leaderboard.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h2 className="font-bold text-sm text-center">{t('leaderboard.title')}</h2>
            <div className="space-y-1">
              <div className="flex items-center text-[10px] font-medium text-muted-foreground border-b border-border pb-2 mb-1 uppercase tracking-wider">
                <span className="w-8 text-center">{t('leaderboard.rank')}</span>
                <span className="flex-1 ps-2">{t('leaderboard.player')}</span>
                <span className="w-12 text-center">{t('leaderboard.points')}</span>
                <span className="w-12 text-center">{t('leaderboard.jokers')}</span>
              </div>
              {leaderboard.map((row, i) => (
                <div
                  key={row.user_id}
                  className={`flex items-center py-2 rounded-lg px-1 ${
                    row.user_id === user?.id ? 'bg-primary/10' : ''
                  }`}
                >
                  <span className="w-8 text-center text-sm font-bold">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </span>
                  <span className="flex-1 ps-2 text-sm truncate font-medium">
                    {row.display_name || '—'}
                  </span>
                  <span className="w-12 text-center text-sm font-bold text-primary">
                    {row.total_points ?? 0}
                  </span>
                  <span className="w-12 text-center text-xs text-muted-foreground">
                    {row.jokers_used ?? 0}/3
                  </span>
                </div>
              ))}
            </div>
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
