import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { supabase } from '@/lib/supabase';
import { generateInviteCode } from '@/lib/invite-code';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function GroupsPage() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useRequireAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [newGroupName, setNewGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_members')
        .select('group_id, joined_at, groups(id, name, invite_code, created_by)')
        .eq('user_id', user!.id)
        .order('joined_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createGroup = useMutation({
    mutationFn: async (name: string) => {
      const code = generateInviteCode();
      const { data: group, error: groupErr } = await supabase
        .from('groups')
        .insert({ name: name.trim(), invite_code: code, created_by: user!.id })
        .select()
        .single();
      if (groupErr) throw groupErr;
      const { error: memberErr } = await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: user!.id });
      if (memberErr) throw memberErr;
      return group;
    },
    onSuccess: (group) => {
      setNewGroupName('');
      setError(null);
      setSuccess(t('groups.createSuccess'));
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      navigate(`/groups/${group.id}`);
    },
    onError: (err: Error) => {
      setError(err.message);
      setSuccess(null);
    },
  });

  const joinGroup = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('join_group_by_invite_code', {
        p_code: code.trim(),
      });
      if (error) throw error;
      return data as { group_id: string; group_name: string }[];
    },
    onSuccess: (data) => {
      setJoinCode('');
      setError(null);
      setSuccess(t('groups.joinSuccess'));
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      if (data && data.length > 0) {
        navigate(`/groups/${data[0].group_id}`);
      }
    },
    onError: (err: Error) => {
      if (err.message.includes('Invalid invite code')) {
        setError(t('groups.invalidCode'));
      } else if (err.message.includes('Already a member')) {
        setError(t('groups.alreadyMember'));
      } else {
        setError(err.message);
      }
      setSuccess(null);
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <span className="text-3xl">👥</span>
          <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    createGroup.mutate(newGroupName);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim().length !== 8) return;
    joinGroup.mutate(joinCode);
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-lg mx-auto px-4 pb-4 space-y-4">
        {/* Header */}
        <div className="text-center pt-6 pb-2">
          <span className="text-4xl block mb-2">👥</span>
          <h1 className="text-xl font-bold">{t('groups.title')}</h1>
        </div>

        {/* Feedback messages */}
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl text-center">{error}</div>
        )}
        {success && (
          <div className="bg-primary/10 text-primary text-sm p-3 rounded-xl text-center">{success}</div>
        )}

        {/* Create Group */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="font-bold text-sm">{t('groups.create')}</h2>
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder={t('groups.groupName')}
              maxLength={50}
              className="flex-1 rounded-xl bg-muted/50"
            />
            <Button
              type="submit"
              disabled={createGroup.isPending || !newGroupName.trim()}
              className="rounded-xl"
            >
              {t('groups.create')}
            </Button>
          </form>
        </div>

        {/* Join Group */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="font-bold text-sm">{t('groups.join')}</h2>
          <form onSubmit={handleJoin} className="flex gap-2">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder={t('groups.enterCode')}
              maxLength={8}
              className="flex-1 font-mono tracking-widest rounded-xl bg-muted/50"
            />
            <Button
              type="submit"
              disabled={joinGroup.isPending || joinCode.trim().length !== 8}
              className="rounded-xl"
            >
              {t('groups.join')}
            </Button>
          </form>
        </div>

        {/* Group List */}
        {groups && groups.length > 0 ? (
          <div className="space-y-3">
            {groups.map((gm) => {
              const g = gm.groups as unknown as {
                id: string;
                name: string;
                invite_code: string;
                created_by: string;
              };
              return (
                <Link key={g.id} to={`/groups/${g.id}`} className="block">
                  <div className="bg-card rounded-2xl border border-border p-4 flex items-center justify-between hover:border-primary/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                        {g.name[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{g.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{g.invite_code}</p>
                      </div>
                    </div>
                    <span className="text-muted-foreground">›</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8 text-sm">{t('groups.noGroups')}</p>
        )}
      </div>
    </div>
  );
}
