import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getTeamName, getAllTeams } from '@/lib/team-utils';
import TeamFlag from '@/components/TeamFlag';

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

  // Pull the canonical 48-team roster from the team dictionary, not from
  // matches — knockout placeholder rows have null home/away_team and would
  // make the list incomplete. Alphabetized in the active language.
  const teams = useMemo(() => getAllTeams(lang), [lang]);

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
        text: locked ? t('tournament.locked') : t('common.saveFailed'),
      });
    },
  });

  /* ---- loading ---- */

  if (authLoading || predLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="text-center space-y-2">
          <span className="text-3xl">🏆</span>
          <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  /* ---- team grid selector ---- */

  function TeamDropdown({
    value,
    onChange,
    exclude,
    label,
    icon,
  }: {
    value: string;
    onChange: (v: string) => void;
    exclude?: string;
    label: string;
    icon: string;
  }) {
    // 48 teams × 2 selectors = ~30 rows of vertical real estate as a grid;
    // a native <select> collapses each picker into a single row and uses the
    // platform's native picker (wheel on iOS, list on Android) — no virtual
    // keyboard required, much faster to scan than scrolling a grid.
    return (
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden="true">{icon}</span>
          <h3 className="font-bold text-sm">{label}</h3>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Inline flag preview for the selected team — preserves visual
              identity that a bare <select> would lose. */}
          <div className="w-11 h-11 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-center shrink-0">
            {value
              ? <TeamFlag team={value} size="md" />
              : <span className="text-muted-foreground/50 text-lg" aria-hidden="true">⚽</span>}
          </div>

          <div className="relative flex-1">
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={isLocked}
              aria-label={label}
              className="w-full h-11 rounded-xl border border-border bg-muted/50 ps-3 pe-9 text-sm font-bold appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <option value="">{t('tournament.selectTeam')}</option>
              {teams.map((team) => {
                const isExcluded = team === exclude;
                return (
                  <option key={team} value={team} disabled={isExcluded}>
                    {getTeamName(team, lang)}{isExcluded ? ' —' : ''}
                  </option>
                );
              })}
            </select>
            {/* Chevron icon — appearance-none above strips the native arrow */}
            <span
              className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs"
              aria-hidden="true"
            >
              ▾
            </span>
          </div>

          {/* Clear button when a team is selected */}
          {value && !isLocked && (
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label={t('common.cancel')}
              className="w-9 h-9 rounded-lg bg-muted/40 hover:bg-muted/60 text-muted-foreground flex items-center justify-center text-sm shrink-0"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ---- player selector ---- */

  function PlayerSelector({
    value,
    onChange,
    freetext,
    onFreetextChange,
    label,
    icon,
  }: {
    value: string;
    onChange: (v: string) => void;
    freetext: string;
    onFreetextChange: (v: string) => void;
    label: string;
    icon: string;
  }) {
    return (
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <h3 className="font-bold text-sm">{label}</h3>
        </div>

        <select
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (e.target.value) onFreetextChange('');
          }}
          disabled={isLocked}
          className="w-full h-10 rounded-xl border border-border bg-muted/50 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <option value="">{lang === 'he' ? 'בחר שחקן' : 'Select player'}</option>
          {playersByTeam.map(([team, pls]) => (
            <optgroup key={team} label={getTeamName(team, lang)}>
              {pls.map((p) => (
                <option key={p.id} value={p.id}>
                  {playerName(p)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">
            {t('tournament.freetext')}
          </label>
          <Input
            value={freetext}
            onChange={(e) => {
              onFreetextChange(e.target.value);
              if (e.target.value) onChange('');
            }}
            disabled={isLocked}
            placeholder={t('tournament.freetext')}
            maxLength={100}
            className="rounded-xl bg-muted/50"
          />
        </div>
      </div>
    );
  }

  /* ---- render ---- */

  return (
    <div className="min-h-[100dvh]">
      <div className="max-w-lg mx-auto px-4 pb-4 space-y-4">
        {/* Header */}
        <div className="text-center pt-6 pb-2">
          <span className="text-4xl block mb-2">🏆</span>
          <h1 className="text-xl font-bold">{t('tournament.title')}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {lang === 'he' ? '15 נק׳ לניחוש נכון' : '15 pts for correct prediction'}
          </p>
        </div>

        {isLocked && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl text-center">
            {t('tournament.locked')}
          </div>
        )}

        {/* Champion */}
        <TeamDropdown
          value={champion}
          onChange={setChampion}
          exclude={runnerUp}
          label={t('tournament.champion')}
          icon="🥇"
        />

        {/* Runner-up */}
        <TeamDropdown
          value={runnerUp}
          onChange={setRunnerUp}
          exclude={champion}
          label={t('tournament.runnerUp')}
          icon="🥈"
        />

        {/* Top Scorer */}
        <PlayerSelector
          value={scorerId}
          onChange={setScorerId}
          freetext={scorerFreetext}
          onFreetextChange={setScorerFreetext}
          label={t('tournament.topScorer')}
          icon="⚽"
        />

        {/* Top Assister */}
        <PlayerSelector
          value={assisterId}
          onChange={setAssisterId}
          freetext={assisterFreetext}
          onFreetextChange={setAssisterFreetext}
          label={t('tournament.topAssister')}
          icon="👟"
        />

        {/* Feedback */}
        {msg && (
          <div
            className={`text-sm p-3 rounded-xl text-center ${
              msg.ok
                ? 'bg-primary/10 text-primary'
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
          className="w-full rounded-xl h-12 text-base font-bold"
        >
          {existing ? t('match.update') : t('common.save')}
        </Button>
      </div>
    </div>
  );
}
