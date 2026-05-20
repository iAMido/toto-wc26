import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { supabase } from '@/lib/supabase';
import { generateInviteCode } from '@/lib/invite-code';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function GroupsPage() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useRequireAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [newGroupName, setNewGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch user's groups via group_members → groups join
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

  // Create group mutation
  const createGroup = useMutation({
    mutationFn: async (name: string) => {
      const code = generateInviteCode();

      // Insert the group (RLS: created_by = auth.uid())
      const { data: group, error: groupErr } = await supabase
        .from('groups')
        .insert({ name: name.trim(), invite_code: code, created_by: user!.id })
        .select()
        .single();
      if (groupErr) throw groupErr;

      // Add creator as first member
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

  // Join group via invite code RPC
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
    return <p className="p-6 text-center">{t('common.loading')}</p>;
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
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pt-4">
        <h1 className="text-2xl font-bold">{t('groups.title')}</h1>
        <Link to="/">
          <Button variant="ghost" size="sm">
            {t('common.back')}
          </Button>
        </Link>
      </div>

      {/* Feedback messages */}
      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{error}</div>
      )}
      {success && (
        <div className="bg-green-500/10 text-green-700 dark:text-green-400 text-sm p-3 rounded-md">
          {success}
        </div>
      )}

      {/* Create Group */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('groups.create')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder={t('groups.groupName')}
              maxLength={50}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={createGroup.isPending || !newGroupName.trim()}
            >
              {t('groups.create')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Join Group */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('groups.join')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoin} className="flex gap-2">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder={t('groups.enterCode')}
              maxLength={8}
              className="flex-1 font-mono tracking-widest"
            />
            <Button
              type="submit"
              disabled={joinGroup.isPending || joinCode.trim().length !== 8}
            >
              {t('groups.join')}
            </Button>
          </form>
        </CardContent>
      </Card>

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
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{g.name}</p>
                      <p className="text-sm text-muted-foreground font-mono">{g.invite_code}</p>
                    </div>
                    <span className="text-muted-foreground text-lg">&#8250;</span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-8">{t('groups.noGroups')}</p>
      )}
    </div>
  );
}
