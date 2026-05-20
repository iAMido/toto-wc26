import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { getAllTeams, getTeamName } from '@/lib/team-utils';
import TeamFlag from '@/components/TeamFlag';

/**
 * Admin panel. Routes that hit /admin without is_admin=true on
 * public.users get bounced to /. Sections:
 *   1. Tournament results — fills tournaments.champion_team / runnerup_team /
 *      top_scorer_player_id / top_assister_player_id. v_group_leaderboard
 *      auto-credits +20 / +15 / +25 / +25 to everyone who guessed right.
 *   2. Manual triggers — POST to sync-fixtures Edge Function + call
 *      resolve_knockout_brackets() RPC on demand.
 *   3. Read-only counters for the rest of the system (matches resolved,
 *      predictions placed, jokers used, etc.) — gives a glance dashboard.
 */
export default function AdminPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useRequireAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();

  // Bounce non-admins. Wait for both auth + admin checks to resolve to avoid
  // a brief redirect on legitimate admins during cold load.
  useEffect(() => {
    if (!authLoading && !adminLoading && user && !isAdmin) {
      navigate('/', { replace: true });
    }
  }, [authLoading, adminLoading, user, isAdmin, navigate]);

  /* ============================================================
   * Data
   * ============================================================ */

  const { data: tournament, isLoading: tournLoading } = useQuery({
    queryKey: ['admin-tournament'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: players } = useQuery({
    queryKey: ['admin-players'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournaments_players')
        .select('id, name_en, name_he, team, role')
        .order('team', { ascending: true })
        .order('name_en', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: counters } = useQuery({
    queryKey: ['admin-counters'],
    queryFn: async () => {
      const [usersR, groupsR, predsR, jokersR, finishedR, tbdR, resolvedR, statsR, historyR] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('groups').select('id', { count: 'exact', head: true }),
        supabase.from('predictions').select('id', { count: 'exact', head: true }),
        supabase.from('predictions').select('id', { count: 'exact', head: true }).eq('joker_used', true),
        supabase.from('matches').select('id', { count: 'exact', head: true }).in('status', ['FT', 'AET', 'PEN']),
        supabase.from('matches').select('id', { count: 'exact', head: true }).is('home_team', null),
        supabase.from('matches').select('id', { count: 'exact', head: true }).not('home_team', 'is', null),
        supabase.from('tournament_player_stats').select('api_player_id', { count: 'exact', head: true }),
        supabase.from('prediction_history').select('id', { count: 'exact', head: true }),
      ]);
      return {
        users: usersR.count ?? 0,
        groups: groupsR.count ?? 0,
        predictions: predsR.count ?? 0,
        jokersUsed: jokersR.count ?? 0,
        matchesFinished: finishedR.count ?? 0,
        matchesTbd: tbdR.count ?? 0,
        matchesResolved: resolvedR.count ?? 0,
        playerStats: statsR.count ?? 0,
        historyRows: historyR.count ?? 0,
      };
    },
    enabled: isAdmin,
    staleTime: 30_000,
  });

  /* ============================================================
   * Local form state for tournament results
   * ============================================================ */
  const [champion, setChampion] = useState('');
  const [runnerUp, setRunnerUp] = useState('');
  const [scorerId, setScorerId] = useState('');
  const [assisterId, setAssisterId] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (tournament) {
      setChampion(tournament.champion_team ?? '');
      setRunnerUp(tournament.runnerup_team ?? '');
      setScorerId(tournament.top_scorer_player_id ?? '');
      setAssisterId(tournament.top_assister_player_id ?? '');
    }
  }, [tournament]);

  const teamOptions = useMemo(() => getAllTeams(lang), [lang]);
  const playerName = (p: { name_en: string; name_he: string | null }) =>
    lang === 'he' && p.name_he ? p.name_he : p.name_en;

  /* ============================================================
   * Mutations
   * ============================================================ */

  const saveResults = useMutation({
    mutationFn: async () => {
      if (!tournament) throw new Error('No tournament row');
      const payload = {
        champion_team: champion || null,
        runnerup_team: runnerUp || null,
        top_scorer_player_id: scorerId || null,
        top_assister_player_id: assisterId || null,
      };
      const { error } = await supabase
        .from('tournaments')
        .update(payload)
        .eq('id', tournament.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setMsg({ ok: true, text: lang === 'he' ? '✓ תוצאות הטורניר נשמרו' : '✓ Tournament results saved' });
      queryClient.invalidateQueries({ queryKey: ['admin-tournament'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['v_group_leaderboard'] });
      setTimeout(() => setMsg(null), 3000);
    },
    onError: (err: Error) => {
      setMsg({ ok: false, text: err.message });
      setTimeout(() => setMsg(null), 4000);
    },
  });

  const runSync = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-fixtures', { body: {} });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setActionMsg({ ok: true, text: `✓ Sync: ${JSON.stringify(data)}` });
      queryClient.invalidateQueries({ queryKey: ['admin-counters'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['top-scorers'] });
      queryClient.invalidateQueries({ queryKey: ['top-assisters'] });
      setTimeout(() => setActionMsg(null), 5000);
    },
    onError: (err: Error) => {
      setActionMsg({ ok: false, text: `Sync failed: ${err.message}` });
      setTimeout(() => setActionMsg(null), 5000);
    },
  });

  const runResolver = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('resolve_knockout_brackets');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const updates = (data as { updates?: number })?.updates ?? 0;
      setActionMsg({
        ok: true,
        text: lang === 'he' ? `✓ פותרו ${updates} משבצות נוקאאוט` : `✓ Resolved ${updates} knockout slots`,
      });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['admin-counters'] });
      setTimeout(() => setActionMsg(null), 5000);
    },
    onError: (err: Error) => {
      setActionMsg({ ok: false, text: `Resolver failed: ${err.message}` });
      setTimeout(() => setActionMsg(null), 5000);
    },
  });

  /* ============================================================
   * Render
   * ============================================================ */

  if (authLoading || adminLoading || tournLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="text-center space-y-2">
          <span className="text-3xl">⚙️</span>
          <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null; // redirect already fired

  return (
    <div className="min-h-[100dvh]">
      <div className="max-w-lg mx-auto px-4 pb-4 space-y-4">
        {/* Header */}
        <div className="text-center pt-6 pb-2">
          <span className="text-4xl block mb-2">⚙️</span>
          <h1 className="text-xl font-bold">{lang === 'he' ? 'פאנל ניהול' : 'Admin Panel'}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {lang === 'he' ? 'גישת מנהל בלבד' : 'Admin-only controls'}
          </p>
        </div>

        {/* ============ Counters ============ */}
        {counters && (
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h2 className="text-sm font-bold">📊 {lang === 'he' ? 'סטטיסטיקה כללית' : 'System counters'}</h2>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <Counter label={lang === 'he' ? 'משתמשים' : 'Users'} value={counters.users} />
              <Counter label={lang === 'he' ? 'קבוצות' : 'Groups'} value={counters.groups} />
              <Counter label={lang === 'he' ? 'ניחושים' : 'Predictions'} value={counters.predictions} />
              <Counter label={lang === 'he' ? 'ג׳וקרים' : 'Jokers'} value={counters.jokersUsed} accent="amber" />
              <Counter label={lang === 'he' ? 'משחקים גמורים' : 'Finished'} value={counters.matchesFinished} accent="primary" />
              <Counter label={lang === 'he' ? 'TBD' : 'TBD'} value={counters.matchesTbd} accent="muted" />
              <Counter label={lang === 'he' ? 'משחקים פתורים' : 'Resolved'} value={counters.matchesResolved} accent="primary" />
              <Counter label={lang === 'he' ? 'שחקנים עם נתונים' : 'Player stats'} value={counters.playerStats} />
              <Counter label={lang === 'he' ? 'היסטוריית ניחושים' : 'History rows'} value={counters.historyRows} />
            </div>
          </div>
        )}

        {/* ============ Manual triggers ============ */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="text-sm font-bold">⚡ {lang === 'he' ? 'הפעלות ידניות' : 'Manual actions'}</h2>
          <p className="text-[11px] text-muted-foreground">
            {lang === 'he'
              ? 'הפעל סנכרון או פתרון נוקאאוט מיד, בלי להמתין ל-cron.'
              : 'Trigger sync or bracket resolution right now, without waiting for cron.'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => runSync.mutate()}
              disabled={runSync.isPending}
              className="rounded-xl h-11 font-bold"
            >
              🔄 {runSync.isPending
                ? (lang === 'he' ? 'מסנכרן...' : 'Syncing...')
                : (lang === 'he' ? 'הפעל סנכרון' : 'Run sync')}
            </Button>
            <Button
              variant="outline"
              onClick={() => runResolver.mutate()}
              disabled={runResolver.isPending}
              className="rounded-xl h-11 font-bold"
            >
              🧩 {runResolver.isPending
                ? (lang === 'he' ? 'פותר...' : 'Resolving...')
                : (lang === 'he' ? 'פתור נוקאאוט' : 'Resolve bracket')}
            </Button>
          </div>
          {actionMsg && (
            <p
              className={`text-[11px] break-words font-mono ${actionMsg.ok ? 'text-primary' : 'text-destructive'}`}
              role="status"
            >
              {actionMsg.text}
            </p>
          )}
        </div>

        {/* ============ Tournament results setter ============ */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="text-sm font-bold">🏆 {lang === 'he' ? 'תוצאות סופיות של הטורניר' : 'Tournament outright results'}</h2>
          <p className="text-[11px] text-muted-foreground">
            {lang === 'he'
              ? 'מילוי השדות האלה מוסיף אוטומטית +20 / +15 / +25 / +25 לכל מי שניחש נכון.'
              : 'Filling these auto-credits +20 / +15 / +25 / +25 to every user who guessed right.'}
          </p>

          <Row label={`🥇 ${lang === 'he' ? 'אלופת העולם' : 'Champion'} (+20)`}>
            <TeamSelect value={champion} onChange={setChampion} teams={teamOptions} lang={lang} />
          </Row>

          <Row label={`🥈 ${lang === 'he' ? 'סגנית' : 'Runner-up'} (+15)`}>
            <TeamSelect value={runnerUp} onChange={setRunnerUp} teams={teamOptions} exclude={champion} lang={lang} />
          </Row>

          <Row label={`⚽ ${lang === 'he' ? 'מלך השערים' : 'Top scorer'} (+25)`}>
            <select
              value={scorerId}
              onChange={(e) => setScorerId(e.target.value)}
              className="w-full h-11 rounded-xl border border-border bg-muted/50 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">— {lang === 'he' ? 'בחר שחקן' : 'Select player'} —</option>
              {players?.map((p) => (
                <option key={p.id} value={p.id}>
                  {playerName(p)} ({p.team})
                </option>
              ))}
            </select>
          </Row>

          <Row label={`👟 ${lang === 'he' ? 'מלך הבישולים' : 'Top assister'} (+25)`}>
            <select
              value={assisterId}
              onChange={(e) => setAssisterId(e.target.value)}
              className="w-full h-11 rounded-xl border border-border bg-muted/50 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">— {lang === 'he' ? 'בחר שחקן' : 'Select player'} —</option>
              {players?.map((p) => (
                <option key={p.id} value={p.id}>
                  {playerName(p)} ({p.team})
                </option>
              ))}
            </select>
          </Row>

          <Button
            onClick={() => saveResults.mutate()}
            disabled={saveResults.isPending}
            className="w-full rounded-xl h-11 font-bold mt-2"
          >
            {saveResults.isPending
              ? (lang === 'he' ? 'שומר...' : 'Saving...')
              : (lang === 'he' ? 'שמור תוצאות' : 'Save results')}
          </Button>

          {msg && (
            <p className={`text-xs text-center ${msg.ok ? 'text-primary' : 'text-destructive'}`} role="status">
              {msg.text}
            </p>
          )}
        </div>

        {/* ============ Help notes ============ */}
        <div className="bg-muted/30 rounded-xl border border-border/40 p-3 space-y-2">
          <h3 className="text-xs font-bold">{lang === 'he' ? 'הערות' : 'Notes'}</h3>
          <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
            <li>{lang === 'he' ? 'הסנכרון פועל אוטומטית כל 20 דקות בשעות המשחקים.' : 'Sync runs automatically every 20 min during match hours.'}</li>
            <li>{lang === 'he' ? 'הפותר מפעיל את resolve_knockout_brackets() — בטוח להפעיל מתי שרוצים.' : 'Resolver calls resolve_knockout_brackets() — safe to invoke anytime.'}</li>
            <li>{lang === 'he' ? 'תקציב API-Football: ~32 קריאות ביום בימי משחק.' : 'API-Football budget: ~32 calls/day on match days.'}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Small local helpers
 * ============================================================ */

function Counter({ label, value, accent }: { label: string; value: number; accent?: 'amber' | 'primary' | 'muted' }) {
  const color =
    accent === 'amber' ? 'text-amber-400'
    : accent === 'primary' ? 'text-primary'
    : accent === 'muted' ? 'text-muted-foreground'
    : 'text-foreground';
  return (
    <div className="bg-muted/30 rounded-lg p-2">
      <div className={`text-lg font-black tabular-nums ${color}`}>{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function TeamSelect({
  value, onChange, teams, exclude, lang,
}: {
  value: string;
  onChange: (v: string) => void;
  teams: string[];
  exclude?: string;
  lang: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-10 h-10 rounded-lg bg-muted/40 border border-border/50 flex items-center justify-center shrink-0">
        {value
          ? <TeamFlag team={value} size="sm" />
          : <span className="text-muted-foreground/40 text-base" aria-hidden="true">⚽</span>}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 h-11 rounded-xl border border-border bg-muted/50 px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">— {lang === 'he' ? 'בחר נבחרת' : 'Select team'} —</option>
        {teams.map((team) => (
          <option key={team} value={team} disabled={team === exclude}>
            {getTeamName(team, lang)}{team === exclude ? ' —' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
