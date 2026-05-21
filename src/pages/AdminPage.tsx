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

  /* ---------- Sync log ---------- */
  const { data: syncLogs } = useQuery({
    queryKey: ['admin-sync-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_log')
        .select('*')
        .order('ran_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
    refetchInterval: 30_000, // poll every 30s so admin sees fresh runs
  });

  /* ---------- Users (admin RPC; bypasses ordinary RLS) ---------- */
  const { data: allUsers, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_users');
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        email: string | null;
        display_name: string | null;
        is_admin: boolean;
        banned_at: string | null;
        created_at: string;
        groups_count: number;
        match_points: number;
        predictions_count: number;
      }>;
    },
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const setUserState = useMutation({
    mutationFn: async (p: { user_id: string; banned?: boolean; new_display_name?: string }) => {
      const { error } = await supabase.rpc('admin_set_user_state', {
        p_user_id: p.user_id,
        p_banned: p.banned ?? null,
        p_new_display_name: p.new_display_name ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-counters'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });

  /* ---------- Match override ---------- */
  const [overrideMatchNumber, setOverrideMatchNumber] = useState<string>('');
  const overrideMatchNum = Number(overrideMatchNumber) || 0;
  const { data: overrideMatch } = useQuery({
    queryKey: ['admin-match', overrideMatchNum],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('match_number', overrideMatchNum)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: isAdmin && overrideMatchNum > 0,
  });

  const [overrideStatus, setOverrideStatus] = useState<string>('FT');
  const [overrideHome, setOverrideHome] = useState<string>('');
  const [overrideAway, setOverrideAway] = useState<string>('');
  const [overrideAdvancer, setOverrideAdvancer] = useState<string>('');

  useEffect(() => {
    if (overrideMatch) {
      setOverrideStatus(overrideMatch.status ?? 'FT');
      setOverrideHome(overrideMatch.home_score_120?.toString() ?? '');
      setOverrideAway(overrideMatch.away_score_120?.toString() ?? '');
      setOverrideAdvancer(overrideMatch.advancer_team_id ?? '');
    }
  }, [overrideMatch]);

  const saveOverride = useMutation({
    mutationFn: async () => {
      if (!overrideMatch) throw new Error('no_match');
      const { error } = await supabase.rpc('admin_override_match', {
        p_match_id: overrideMatch.id,
        p_status: overrideStatus,
        p_home_score_120: Number(overrideHome),
        p_away_score_120: Number(overrideAway),
        p_advancer_team_id: overrideAdvancer || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setActionMsg({ ok: true, text: lang === 'he' ? '✓ המשחק עודכן' : '✓ Match overridden' });
      queryClient.invalidateQueries({ queryKey: ['admin-match', overrideMatchNum] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['admin-counters'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      setTimeout(() => setActionMsg(null), 4000);
    },
    onError: (err: Error) => {
      setActionMsg({ ok: false, text: err.message });
      setTimeout(() => setActionMsg(null), 5000);
    },
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

        {/* ============ Sync log (latest run + last 10 history) ============ */}
        <SyncLogCard syncLogs={syncLogs ?? []} lang={lang} />

        {/* ============ Manual match override ============ */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="text-sm font-bold">🛠 {lang === 'he' ? 'התערבות ידנית במשחק' : 'Manual match override'}</h2>
          <p className="text-[11px] text-muted-foreground">
            {lang === 'he'
              ? 'אם API-Football מחזיר תוצאה שגויה, אפשר לתקן כאן. השינוי מפעיל מחדש את חישוב הניקוד.'
              : 'If API-Football returns corrupt data, fix it here. Triggers the scoring recalculation automatically.'}
          </p>

          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground shrink-0">
              {lang === 'he' ? 'מס׳ משחק:' : 'Match #:'}
            </label>
            <input
              type="number"
              min={1}
              max={104}
              value={overrideMatchNumber}
              onChange={(e) => setOverrideMatchNumber(e.target.value)}
              placeholder="1–104"
              className="w-24 h-10 rounded-xl border border-border bg-muted/50 px-3 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {overrideMatch ? (
            <div className="space-y-3 pt-2 border-t border-border/50">
              <p className="text-xs">
                <span className="font-bold">{overrideMatch.home_team ?? '—'}</span>
                {' vs '}
                <span className="font-bold">{overrideMatch.away_team ?? '—'}</span>
                <span className="text-muted-foreground ms-2">
                  ({new Date(overrideMatch.kickoff_at).toLocaleString(lang === 'he' ? 'he-IL' : 'en-US')})
                </span>
              </p>

              <div className="grid grid-cols-2 gap-2">
                <Row label={lang === 'he' ? 'סטטוס' : 'Status'}>
                  <select
                    value={overrideStatus}
                    onChange={(e) => setOverrideStatus(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-muted/50 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {['NS', '1H', 'HT', '2H', 'ET', 'BT', 'P', 'FT', 'AET', 'PEN', 'PST', 'CANC'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Row>
                <Row label={lang === 'he' ? 'מנצח פנדלים' : 'PEN winner'}>
                  <select
                    value={overrideAdvancer}
                    onChange={(e) => setOverrideAdvancer(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-muted/50 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">—</option>
                    {overrideMatch.home_team && <option value={overrideMatch.home_team}>{overrideMatch.home_team}</option>}
                    {overrideMatch.away_team && <option value={overrideMatch.away_team}>{overrideMatch.away_team}</option>}
                  </select>
                </Row>
                <Row label={lang === 'he' ? 'בית' : 'Home'}>
                  <input
                    type="number" min={0} max={30}
                    value={overrideHome}
                    onChange={(e) => setOverrideHome(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-muted/50 px-3 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </Row>
                <Row label={lang === 'he' ? 'חוץ' : 'Away'}>
                  <input
                    type="number" min={0} max={30}
                    value={overrideAway}
                    onChange={(e) => setOverrideAway(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border bg-muted/50 px-3 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </Row>
              </div>

              <Button
                onClick={() => saveOverride.mutate()}
                disabled={saveOverride.isPending || !overrideHome || !overrideAway}
                className="w-full rounded-xl h-10 font-bold"
              >
                {saveOverride.isPending
                  ? (lang === 'he' ? 'שומר...' : 'Saving...')
                  : (lang === 'he' ? 'שמור התערבות' : 'Save override')}
              </Button>
            </div>
          ) : overrideMatchNum > 0 ? (
            <p className="text-[11px] text-muted-foreground">
              {lang === 'he' ? 'משחק לא נמצא' : 'Match not found'}
            </p>
          ) : null}
        </div>

        {/* ============ User management ============ */}
        <UserMgmtCard
          users={allUsers ?? []}
          loading={usersLoading}
          lang={lang}
          currentUserId={user?.id ?? ''}
          onSetState={(p) => setUserState.mutate(p)}
          isSaving={setUserState.isPending}
        />

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

/* ============================================================
 * Sync-log card — surfaces the public.sync_log audit trail.
 * Massive red banner if the newest run failed OR is stale during match hours.
 * ============================================================ */
type SyncLogRow = {
  id: string;
  ran_at: string;
  duration_ms: number | null;
  status: 'ok' | 'partial' | 'error';
  detail: Record<string, unknown>;
  api_calls: number;
  fixtures_updated: number;
  scorers_updated: number;
  assisters_updated: number;
  knockouts_resolved: number;
};

function SyncLogCard({ syncLogs, lang }: { syncLogs: SyncLogRow[]; lang: string }) {
  const latest = syncLogs[0];
  const stale = latest
    ? Date.now() - new Date(latest.ran_at).getTime() > 30 * 60_000 // >30 min ago
    : true;
  const utcHour = new Date().getUTCHours();
  const inMatchHours = utcHour >= 10 || utcHour <= 2; // matches the cron window
  const showRedAlert = !latest
    || latest.status === 'error'
    || (stale && inMatchHours);

  const statusBadge = (s: SyncLogRow['status']) => {
    const cls =
      s === 'ok' ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40'
      : s === 'partial' ? 'bg-amber-900/40 text-amber-300 border-amber-700/40'
      : 'bg-destructive/30 text-destructive border-destructive/50';
    return (
      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${cls}`}>
        {s}
      </span>
    );
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">📡 {lang === 'he' ? 'יומן סנכרון' : 'Sync log'}</h2>
        {latest && statusBadge(latest.status)}
      </div>

      {showRedAlert && (
        <div className="bg-destructive/15 border border-destructive/40 rounded-xl p-3 text-destructive text-xs font-bold flex items-start gap-2">
          <span>⚠️</span>
          <span>
            {!latest
              ? (lang === 'he' ? 'אין רישומי סנכרון. ה-cron אולי לא רץ.' : 'No sync runs recorded — cron may not be running.')
              : latest.status === 'error'
                ? (lang === 'he' ? 'הריצה האחרונה נכשלה במלואה. API-Football אולי לא זמין.' : 'Last sync run failed completely — API-Football may be down.')
                : (lang === 'he' ? 'אין סנכרון תקין בחצי שעה האחרונה ויש משחקים פעילים.' : 'No successful sync in the last 30 min during match hours.')}
          </span>
        </div>
      )}

      {syncLogs.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {lang === 'he' ? 'אין נתונים עדיין.' : 'No data yet.'}
        </p>
      ) : (
        <div className="space-y-1">
          {/* Header */}
          <div className="grid grid-cols-[1fr_3rem_3rem_3rem] gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border pb-1">
            <span>{lang === 'he' ? 'זמן' : 'When'}</span>
            <span className="text-center">API</span>
            <span className="text-center">{lang === 'he' ? 'תוצ׳' : 'Fix'}</span>
            <span className="text-center">{lang === 'he' ? 'משך' : 'Ms'}</span>
          </div>
          {syncLogs.map((r) => (
            <div
              key={r.id}
              className={`grid grid-cols-[1fr_3rem_3rem_3rem] gap-1 items-center text-[11px] py-1 tabular-nums ${
                r.status === 'error' ? 'text-destructive'
                : r.status === 'partial' ? 'text-amber-300'
                : ''
              }`}
            >
              <span className="truncate">
                {new Date(r.ran_at).toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
                {' '}
                {statusBadge(r.status)}
              </span>
              <span className="text-center">{r.api_calls}</span>
              <span className="text-center">{r.fixtures_updated}</span>
              <span className="text-center">{r.duration_ms ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * User-management card — list, edit display_name, toggle ban.
 * ============================================================ */
type AdminUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  is_admin: boolean;
  banned_at: string | null;
  created_at: string;
  groups_count: number;
  match_points: number;
  predictions_count: number;
};

function UserMgmtCard({
  users, loading, lang, currentUserId, onSetState, isSaving,
}: {
  users: AdminUser[];
  loading: boolean;
  lang: string;
  currentUserId: string;
  onSetState: (p: { user_id: string; banned?: boolean; new_display_name?: string }) => void;
  isSaving: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <h2 className="text-sm font-bold">👥 {lang === 'he' ? 'ניהול משתמשים' : 'User management'}</h2>

      {loading ? (
        <p className="text-xs text-muted-foreground">{lang === 'he' ? 'טוען...' : 'Loading...'}</p>
      ) : users.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {lang === 'he' ? 'אין משתמשים עדיין.' : 'No users yet.'}
        </p>
      ) : (
        <div className="space-y-1.5">
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            const isBanned = !!u.banned_at;
            const isEditingThis = editingId === u.id;
            return (
              <div
                key={u.id}
                className={`rounded-lg border p-2 space-y-1.5 ${
                  isBanned ? 'border-destructive/40 bg-destructive/5'
                  : isSelf ? 'border-primary/30 bg-primary/5'
                  : 'border-border/50 bg-muted/20'
                }`}
              >
                <div className="flex items-center gap-2">
                  {/* Name (or inline edit) */}
                  {isEditingThis ? (
                    <input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && draftName.trim().length >= 2) {
                          onSetState({ user_id: u.id, new_display_name: draftName });
                          setEditingId(null);
                        } else if (e.key === 'Escape') {
                          setEditingId(null);
                        }
                      }}
                      className="flex-1 h-7 rounded border border-border bg-muted/50 px-2 text-xs"
                      autoFocus
                    />
                  ) : (
                    <span className="flex-1 text-sm font-bold truncate">
                      {u.display_name ?? '—'}
                      {u.is_admin && <span className="text-[9px] text-amber-300 ms-1.5 font-black">[ADMIN]</span>}
                      {isBanned && <span className="text-[9px] text-destructive ms-1.5 font-black">[BANNED]</span>}
                      {isSelf && <span className="text-[9px] text-primary ms-1.5">({lang === 'he' ? 'אני' : 'you'})</span>}
                    </span>
                  )}

                  {/* Edit/ban controls (hidden for self to avoid self-pwn) */}
                  {!isSelf && !isEditingThis && (
                    <>
                      <button
                        onClick={() => { setEditingId(u.id); setDraftName(u.display_name ?? ''); }}
                        className="text-[10px] text-primary hover:underline px-1"
                      >
                        ✏
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(
                            isBanned
                              ? (lang === 'he' ? 'לבטל חסימה?' : 'Unban this user?')
                              : (lang === 'he' ? `לחסום את ${u.display_name ?? u.email}?` : `Ban ${u.display_name ?? u.email}?`)
                          )) {
                            onSetState({ user_id: u.id, banned: !isBanned });
                          }
                        }}
                        disabled={isSaving}
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          isBanned
                            ? 'text-emerald-300 hover:bg-emerald-900/20'
                            : 'text-destructive hover:bg-destructive/10'
                        }`}
                      >
                        {isBanned ? (lang === 'he' ? 'בטל חסימה' : 'Unban') : (lang === 'he' ? 'חסום' : 'Ban')}
                      </button>
                    </>
                  )}
                  {isEditingThis && (
                    <>
                      <button
                        onClick={() => {
                          if (draftName.trim().length >= 2) {
                            onSetState({ user_id: u.id, new_display_name: draftName });
                            setEditingId(null);
                          }
                        }}
                        className="text-[10px] text-primary px-1"
                      >
                        ✓
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-[10px] text-muted-foreground px-1">
                        ✕
                      </button>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span dir="ltr" className="truncate">{u.email ?? '—'}</span>
                  <span className="ms-auto tabular-nums shrink-0">
                    {u.match_points} {lang === 'he' ? 'נק׳' : 'pts'} ·
                    {' '}{u.predictions_count} {lang === 'he' ? 'ניחושים' : 'preds'} ·
                    {' '}{u.groups_count} {lang === 'he' ? 'קבוצות' : 'groups'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
