import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function GroupDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useRequireAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [codeCopied, setCodeCopied] = useState(false);

  // Fetch group info
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

  // Fetch members with display names
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

  // Fetch leaderboard from the view (only populated after matches are scored)
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

  // Leave group (delete own membership row)
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
      // Fallback for environments without clipboard API
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
    return <p className="p-6 text-center">{t('common.loading')}</p>;
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
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pt-4">
        <h1 className="text-2xl font-bold">{group.name}</h1>
        <Link to="/groups">
          <Button variant="ghost" size="sm">
            {t('common.back')}
          </Button>
        </Link>
      </div>

      {/* Invite Code */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('groups.inviteCode')}</p>
              <p className="text-2xl font-mono font-bold tracking-widest">
                {group.invite_code}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={copyInviteCode}>
              {codeCopied ? t('groups.copied') : t('groups.shareCode')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard (shown only when there are scored matches) */}
      {leaderboard && leaderboard.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('leaderboard.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {/* Table header */}
              <div className="flex items-center text-sm font-medium text-muted-foreground border-b pb-2 mb-2">
                <span className="w-8 text-center">{t('leaderboard.rank')}</span>
                <span className="flex-1 ps-2">{t('leaderboard.player')}</span>
                <span className="w-12 text-center">{t('leaderboard.points')}</span>
                <span className="w-12 text-center">{t('leaderboard.jokers')}</span>
                <span className="w-12 text-center">{t('leaderboard.matches')}</span>
              </div>
              {leaderboard.map((row, i) => (
                <div
                  key={row.user_id}
                  className={`flex items-center py-1.5 rounded px-1 ${
                    row.user_id === user?.id ? 'bg-accent/50 font-semibold' : ''
                  }`}
                >
                  <span className="w-8 text-center text-sm">{i + 1}</span>
                  <span className="flex-1 ps-2 text-sm truncate">
                    {row.display_name || '—'}
                  </span>
                  <span className="w-12 text-center text-sm font-bold">
                    {row.total_points ?? 0}
                  </span>
                  <span className="w-12 text-center text-sm">{row.jokers_used ?? 0}/3</span>
                  <span className="w-12 text-center text-sm">{row.matches_scored ?? 0}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t('groups.members')} ({members?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                  <span className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold shrink-0">
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
        </CardContent>
      </Card>

      {/* Leave Group (only non-creators) */}
      {!isCreator && (
        <div className="text-center pt-4 pb-8">
          <button
            onClick={() => {
              if (window.confirm(t('groups.leaveConfirm'))) {
                leaveGroup.mutate();
              }
            }}
            className="text-sm text-destructive underline underline-offset-4 hover:text-destructive/80"
            disabled={leaveGroup.isPending}
          >
            {t('groups.leaveGroup')}
          </button>
        </div>
      )}
    </div>
  );
}
