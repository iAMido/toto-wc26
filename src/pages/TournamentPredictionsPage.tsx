import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

/* ---------- component ---------- */

export default function TournamentPredictionsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user, loading: authLoading } = useRequireAuth();
  const queryClient = useQueryClient();

  // Form state
  const [champion, setChampion] = useState('');
  const [runnerUp, setRunnerUp] = useState('');
  const [scorerId, setScorerId] = useState('');
  const [scorerFreetext, setScorerFreetext] = useState('');
  const [assisterId, setAssisterId] = useState('');
  const [assisterFreetext, setAssisterFreetext] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  /* ---- data ---- */

  // Fetch tournament start_at to determine lock state
  const { data: tournament } = useQuery({
    queryKey: ['tournament'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch teams from matches (unique home/away teams)
  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('home_team, away_team');
      if (error) throw error;
      const set = new Set<string>();
      data?.forEach((m) => {
        set.add(m.home_team);
        set.add(m.away_team);
      });
      return Array.from(set).sort();
    },
  });

  // Fetch players (forwards + midfielders for scorer/assister)
  const { data: players } = useQuery({
    queryKey: ['tournament-players'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournaments_players')
        .select('id, name_en, name_he, team, role')
        .in('role', ['FW', 'MF'])
        .order('team', { ascending: true })
        .order('name_en', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing prediction
  const { data: existing, isLoading: predLoading } = useQuery({
    queryKey: ['tournament-prediction', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournament_predictions')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Seed form from existing prediction
  useEffect(() => {
    if (existing) {
      setChampion(existing.champion_team ?? '');
      setRunnerUp(existing.runnerup_team ?? '');
      setScorerId(existing.top_scorer_player_id ?? '');
      setScorerFreetext(existing.scorer_freetext ?? '');
      setAssisterId(existing.top_assister_player_id ?? '');
      setAssisterFreetext(existing.assister_freetext ?? '');
    }
  }, [existing]);

  /* ---- derived ---- */

  const isLocked = tournament
    ? new Date() >= new Date(tournament.start_at)
    : false;

  // Group players by team for a nicer dropdown
  const playersByTeam = useMemo(() => {
    if (!players) return [];
    const map = new Map<string, typeof players>();
    for (const p of players) {
      const arr = map.get(p.team) ?? [];
      arr.push(p);
      map.set(p.team, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [players]);

  const playerName = (p: { name_en: string; name_he: string | null }) =>
    lang === 'he' && p.name_he ? p.name_he : p.name_en;

  /* ---- mutation ---- */

  const submit = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        user_id: user!.id,
        champion_team: champion || null,
        runnerup_team: runnerUp || null,
        top_scorer_player_id: scorerId || null,
        scorer_freetext: scorerFreetext || null,
        top_assister_player_id: assisterId || null,
        assister_freetext: assisterFreetext || null,
      };

      const { error } = await supabase
        .from('tournament_predictions')
        .upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      setMsg({ ok: true, text: t('tournament.saved') });
      queryClient.invalidateQueries({
        queryKey: ['tournament-prediction'],
      });
    },
    onError: (err: Error) => {
      const locked =
        err.message.includes('row-level security') ||
        err.message.includes('violates') ||
        err.message.includes('new row');
      setMsg({
        ok: false,
        text: locked ? t('tournament.locked') : err.message,
      });
    },
  });

  /* ---- loading ---- */

  if (authLoading || predLoading) {
    return <p className="p-6 text-center">{t('common.loading')}</p>;
  }

  /* ---- render ---- */

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between pt-4">
        <h1 className="text-2xl font-bold">{t('tournament.title')}</h1>
        <Link to="/">
          <Button variant="ghost" size="sm">
            {t('common.back')}
          </Button>
        </Link>
      </div>

      {isLocked && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
          {t('tournament.locked')}
        </div>
      )}

      {/* Champion */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('tournament.champion')}</CardTitle>
          <CardDescription>{t('tournament.selectTeam')}</CardDescription>
        </CardHeader>
        <CardContent>
          <select
            value={champion}
            onChange={(e) => setChampion(e.target.value)}
            disabled={isLocked}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <option value="">—</option>
            {teams?.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Runner-up */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('tournament.runnerUp')}</CardTitle>
          <CardDescription>{t('tournament.selectTeam')}</CardDescription>
        </CardHeader>
        <CardContent>
          <select
            value={runnerUp}
            onChange={(e) => setRunnerUp(e.target.value)}
            disabled={isLocked}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <option value="">—</option>
            {teams?.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Top Scorer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('tournament.topScorer')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            value={scorerId}
            onChange={(e) => {
              setScorerId(e.target.value);
              if (e.target.value) setScorerFreetext('');
            }}
            disabled={isLocked}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <option value="">—</option>
            {playersByTeam.map(([team, pls]) => (
              <optgroup key={team} label={team}>
                {pls.map((p) => (
                  <option key={p.id} value={p.id}>
                    {playerName(p)} ({p.team})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              {t('tournament.freetext')}
            </label>
            <Input
              value={scorerFreetext}
              onChange={(e) => {
                setScorerFreetext(e.target.value);
                if (e.target.value) setScorerId('');
              }}
              disabled={isLocked}
              placeholder={t('tournament.freetext')}
              maxLength={100}
            />
          </div>
        </CardContent>
      </Card>

      {/* Top Assister */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('tournament.topAssister')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            value={assisterId}
            onChange={(e) => {
              setAssisterId(e.target.value);
              if (e.target.value) setAssisterFreetext('');
            }}
            disabled={isLocked}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <option value="">—</option>
            {playersByTeam.map(([team, pls]) => (
              <optgroup key={team} label={team}>
                {pls.map((p) => (
                  <option key={p.id} value={p.id}>
                    {playerName(p)} ({p.team})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              {t('tournament.freetext')}
            </label>
            <Input
              value={assisterFreetext}
              onChange={(e) => {
                setAssisterFreetext(e.target.value);
                if (e.target.value) setAssisterId('');
              }}
              disabled={isLocked}
              placeholder={t('tournament.freetext')}
              maxLength={100}
            />
          </div>
        </CardContent>
      </Card>

      {/* Feedback */}
      {msg && (
        <div
          className={`text-sm p-3 rounded-md ${
            msg.ok
              ? 'bg-green-500/10 text-green-700 dark:text-green-400'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Submit */}
      <Button
        onClick={() => submit.mutate()}
        disabled={isLocked || submit.isPending}
        className="w-full"
      >
        {existing ? t('match.update') : t('common.save')}
      </Button>
    </div>
  );
}
