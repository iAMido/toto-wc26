import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useJokerBudget } from '@/hooks/useJokerBudget';
import { supabase } from '@/lib/supabase';
import InlineMatchCard from '@/components/InlineMatchCard';
import HowToPlayModal from '@/components/HowToPlayModal';

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user, loading } = useRequireAuth();
  const { data: jokerBudget } = useJokerBudget();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  // Countdown to tournament start (June 11, 2026)
  const TOURNAMENT_START = new Date('2026-06-11T22:00:00+03:00');
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    const calc = () => {
      const diff = TOURNAMENT_START.getTime() - Date.now();
      if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0 };
      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        mins: Math.floor((diff / (1000 * 60)) % 60),
        secs: Math.floor((diff / 1000) % 60),
      };
    };
    setCountdown(calc());
    const interval = setInterval(() => setCountdown(calc()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Quick stats
  const { data: matchStats } = useQuery({
    queryKey: ['match-stats', user?.id],
    queryFn: async () => {
      const [matchesRes, predsRes] = await Promise.all([
        supabase.from('matches').select('id', { count: 'exact', head: true }),
        supabase.from('predictions').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
      ]);
      return {
        total: matchesRes.count ?? 0,
        predicted: predsRes.count ?? 0,
      };
    },
    enabled: !!user,
  });

  // Match day: today's matches (or nearest upcoming match day)
  const { data: matchDay } = useQuery({
    queryKey: ['match-day', user?.id],
    queryFn: async () => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

      // Try today's matches first
      const { data: todayMatches } = await supabase
        .from('matches')
        .select('*')
        .gte('kickoff_at', `${todayStr}T00:00:00`)
        .lte('kickoff_at', `${todayStr}T23:59:59`)
        .order('kickoff_at', { ascending: true });

      let dayMatches = todayMatches && todayMatches.length > 0 ? todayMatches : null;
      let label: 'today' | 'next' = 'today';

      // If no matches today, find the next match day
      if (!dayMatches) {
        const { data: upcoming } = await supabase
          .from('matches')
          .select('*')
          .gt('kickoff_at', now.toISOString())
          .order('kickoff_at', { ascending: true })
          .limit(20);

        if (upcoming && upcoming.length > 0) {
          const firstDate = upcoming[0].kickoff_at.split('T')[0];
          dayMatches = upcoming.filter((m) => m.kickoff_at.startsWith(firstDate));
          label = 'next';
        }
      }

      if (!dayMatches || dayMatches.length === 0) return null;

      // Also fetch predictions for these matches
      const ids = dayMatches.map((m) => m.id);
      const { data: preds } = await supabase
        .from('predictions')
        .select('match_id, home, away, joker_used, points, advancer_team_id')
        .eq('user_id', user!.id)
        .in('match_id', ids);

      const predMap = new Map((preds ?? []).map((p) => [p.match_id, p]));

      // Format the date for display
      const dateObj = new Date(dayMatches[0].kickoff_at);
      const dateStr = dateObj.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
        weekday: 'long', day: 'numeric', month: 'long',
      });

      return { label, dateStr, matches: dayMatches, predMap };
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Lightweight api_fixture_id → match_number lookup so InlineMatchCard can
  // render WIN_<id> / LOSE_<id> knockout placeholders as "Winner Match 73".
  const { data: matchNumberLookup } = useQuery({
    queryKey: ['match-number-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('api_fixture_id, match_number');
      if (error) throw error;
      const map = new Map<number, number>();
      for (const row of data ?? []) {
        if (row.api_fixture_id != null && row.match_number != null) {
          map.set(row.api_fixture_id, row.match_number);
        }
      }
      return map;
    },
    enabled: !!user,
    staleTime: 5 * 60_000, // numbers don't change at runtime
  });

  // Fetch user's groups + standings
  const { data: groupStandings } = useQuery({
    queryKey: ['home-standings', user?.id],
    queryFn: async () => {
      const { data: memberships, error: memErr } = await supabase
        .from('group_members')
        .select('group_id, groups(id, name)')
        .eq('user_id', user!.id);
      if (memErr) throw memErr;
      if (!memberships || memberships.length === 0) return [];

      const results = [];
      for (const m of memberships) {
        const g = m.groups as unknown as { id: string; name: string };
        const { data: lb } = await supabase
          .from('v_group_leaderboard')
          .select('user_id, total_points')
          .eq('group_id', g.id)
          .order('total_points', { ascending: false });

        const rank = lb ? lb.findIndex((r) => r.user_id === user!.id) + 1 : 0;
        const totalMembers = lb?.length ?? 0;
        const points = lb?.find((r) => r.user_id === user!.id)?.total_points ?? 0;

        results.push({ groupId: g.id, groupName: g.name, rank, totalMembers, points });
      }
      return results;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Onboarding checklist data
  const { data: onboarding } = useQuery({
    queryKey: ['onboarding', user?.id],
    queryFn: async () => {
      // Bettable matches = matches whose teams are already known. TBD knockout
      // slots (home_team IS NULL) are placeholders the user can't predict on
      // yet, so they shouldn't inflate the 'X matches waiting' count.
      const [groupsRes, predsRes, tournRes, bettableRes] = await Promise.all([
        supabase.from('group_members').select('group_id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('predictions').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('tournament_predictions').select('champion_team, top_scorer_player_id').eq('user_id', user!.id).maybeSingle(),
        supabase.from('matches').select('id', { count: 'exact', head: true }).not('home_team', 'is', null),
      ]);

      const hasGroup = (groupsRes.count ?? 0) > 0;
      const hasChampion = !!tournRes.data?.champion_team;
      const hasScorer = !!tournRes.data?.top_scorer_player_id;
      const totalMatches = bettableRes.count ?? 0;
      const predictedMatches = predsRes.count ?? 0;
      const unpredicted = Math.max(0, totalMatches - predictedMatches);

      const steps = [
        { key: 'group', done: hasGroup },
        { key: 'champion', done: hasChampion },
        { key: 'scorer', done: hasScorer },
        { key: 'predictions', done: predictedMatches > 0 },
      ];

      const completedCount = steps.filter((s) => s.done).length;
      const pct = Math.round((completedCount / steps.length) * 100);

      return { steps, completedCount, pct, unpredicted, totalMatches, predictedMatches };
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  if (loading) {
    return (
      <div className="min-h-[100dvh]">
        <div className="max-w-lg mx-auto px-4 pt-10 space-y-5">
          <div className="flex flex-col items-center gap-2">
            <div className="skeleton-circle w-14 h-14" />
            <div className="skeleton h-7 w-36" />
            <div className="skeleton h-4 w-48" />
          </div>
          <div className="skeleton-card p-4 space-y-3">
            <div className="skeleton h-3 w-32 mx-auto" />
            <div className="flex justify-center gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton w-14 h-16 rounded-lg" />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton-card p-3 h-16" />
            ))}
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-card p-4 h-20" />
          ))}
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const toggleLang = () => {
    const next = i18n.language === 'he' ? 'en' : 'he';
    i18n.changeLanguage(next);
  };

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || '';
  const hasCountdown = countdown.days > 0 || countdown.hours > 0;

  return (
    <div className="min-h-[100dvh]">
      {/* Top bar */}
      <header className="flex items-center justify-between p-4 max-w-lg mx-auto">
        <button
          onClick={toggleLang}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
        >
          {t('nav.switchLang')}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRulesOpen(true)}
            className="text-xs text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-md hover:bg-primary/10 font-medium"
          >
            {t('rules.title')} ❓
          </button>
          <button
            onClick={handleSignOut}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-muted"
          >
            {t('nav.signOut')}
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pb-4 space-y-5">
        {/* Hero */}
        <div className="text-center space-y-1">
          <span className="text-5xl block">⚽</span>
          <h1 className="text-2xl font-black tracking-tight">{t('app.name')}</h1>
          <p className="text-sm text-muted-foreground">{t('app.tagline')}</p>
          <p className="text-xs text-muted-foreground">
            {t('home.welcome')}, <span className="text-primary font-medium">{displayName}</span>
          </p>
        </div>

        {/* Countdown to tournament */}
        {hasCountdown && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <p className="text-xs text-muted-foreground text-center mb-3">
              {lang === 'he' ? '🔒 הניחושים נסגרים ב-11 ביוני 22:45' : '🔒 Predictions lock June 11 22:45'}
            </p>
            {/* Explicit dir flips visual order: Hebrew → days on the right, English → days on the left */}
            <div dir={lang === 'he' ? 'rtl' : 'ltr'} className="flex justify-center gap-3">
              {[
                { val: countdown.days, label: lang === 'he' ? 'ימים' : 'Days' },
                { val: countdown.hours, label: lang === 'he' ? 'שעות' : 'Hours' },
                { val: countdown.mins, label: lang === 'he' ? 'דקות' : 'Min' },
                { val: countdown.secs, label: lang === 'he' ? 'שניות' : 'Sec' },
              ].map((item) => (
                <div key={item.label} className="countdown-box">
                  <div className="countdown-number tabular-nums">{String(item.val).padStart(2, '0')}</div>
                  <div className="countdown-label">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ====== MATCH DAY SECTION ====== */}
        {matchDay && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">
                {matchDay.label === 'today' ? t('home.matchDay') : t('home.nextMatchDay')}
              </h2>
              <span className="text-[10px] text-muted-foreground">{matchDay.dateStr}</span>
            </div>

            {/* Inline match cards */}
            <div className="space-y-2">
              {matchDay.matches.map((m) => {
                const pred = matchDay.predMap.get(m.id);
                return (
                  <InlineMatchCard
                    key={m.id}
                    match={m}
                    prediction={pred ?? undefined}
                    userId={user!.id}
                    expanded={expandedMatchId === m.id}
                    onToggle={() => setExpandedMatchId(expandedMatchId === m.id ? null : m.id)}
                    matchNumberLookup={matchNumberLookup}
                  />
                );
              })}
            </div>

            {/* View all matches link */}
            <Link to="/matches" className="block">
              <div className="text-center py-2">
                <span className="text-xs text-primary font-medium hover:underline">
                  {t('feed.viewAll')} →
                </span>
              </div>
            </Link>
          </div>
        )}

        {/* Quick stats */}
        {matchStats && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-xl border border-border p-3 text-center">
              <p className="text-xl font-bold text-primary">{matchStats.predicted}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {lang === 'he' ? 'ניחושים' : 'Predicted'}
              </p>
            </div>
            <div className="bg-card rounded-xl border border-border p-3 text-center">
              <p className="text-xl font-bold">{matchStats.total - matchStats.predicted}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {lang === 'he' ? 'נותרו' : 'Remaining'}
              </p>
            </div>
            <div className="bg-card rounded-xl border border-border p-3 text-center">
              <p className="text-xl font-bold text-accent-foreground">
                {jokerBudget ? jokerBudget.remaining : 3}/3
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {lang === 'he' ? "ג׳וקרים" : 'Jokers'}
              </p>
            </div>
          </div>
        )}

        {/* Personalized nudge */}
        {onboarding && onboarding.unpredicted > 0 && (
          <Link to="/matches" className="block">
            <div className="bg-amber-900/30 border border-amber-700/30 rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-amber-900/40 transition-colors">
              <span className="text-lg">📢</span>
              <p className="text-xs text-amber-200 flex-1">
                {t('nudge.unpredicted', { count: onboarding.unpredicted })}
              </p>
              <span className="text-amber-400 text-xs font-bold">›</span>
            </div>
          </Link>
        )}

        {/* Onboarding checklist */}
        {onboarding && onboarding.pct < 100 && (
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{t('onboarding.title')}</h3>
              <span className="text-[10px] text-primary font-medium">{t('onboarding.progress', { pct: onboarding.pct })}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${onboarding.pct}%` }}
              />
            </div>
            <div className="space-y-2">
              {onboarding.steps.map((step) => {
                const stepConfig: Record<string, { icon: string; label: string; desc: string; href: string }> = {
                  group: { icon: '👥', label: t('onboarding.stepGroup'), desc: t('onboarding.stepGroupDesc'), href: '/groups' },
                  champion: { icon: '🏆', label: t('onboarding.stepChampion'), desc: t('onboarding.stepChampionDesc'), href: '/tournament' },
                  scorer: { icon: '⚽', label: t('onboarding.stepScorer'), desc: t('onboarding.stepScorerDesc'), href: '/tournament' },
                  predictions: { icon: '🎯', label: t('onboarding.stepPredictions'), desc: t('onboarding.stepPredictionsDesc'), href: '/matches' },
                };
                const cfg = stepConfig[step.key];
                if (!cfg) return null;

                return (
                  <Link key={step.key} to={cfg.href} className="block">
                    <div className={`flex items-center gap-3 rounded-xl p-2.5 transition-colors ${step.done ? 'bg-primary/10 opacity-60' : 'bg-muted/30 hover:bg-muted/50'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${step.done ? 'bg-primary/20' : 'bg-muted'}`}>
                        {step.done ? '✓' : cfg.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium ${step.done ? 'line-through text-muted-foreground' : ''}`}>{cfg.label}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{cfg.desc}</p>
                      </div>
                      {!step.done && <span className="text-muted-foreground text-xs">›</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* When onboarding hits 100%, the entire section disappears — no
            success banner — so the homepage stops nagging the user. */}

        {/* Navigation cards */}
        <div className="space-y-3">
          <Link to="/matches" className="block">
            <div className="bg-card rounded-2xl border border-primary/30 p-4 flex items-center gap-4 hover:border-primary/60 hover:bg-primary/5 transition-all">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-2xl">⚽</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{t('home.predictMatches')}</p>
                <p className="text-xs text-muted-foreground">{t('home.predictMatchesDesc')}</p>
              </div>
              <span className="text-muted-foreground">›</span>
            </div>
          </Link>

          <Link to="/groups" className="block">
            <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-4 hover:border-primary/40 hover:bg-primary/5 transition-all">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <span className="text-2xl">👥</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{t('home.myGroups')}</p>
                <p className="text-xs text-muted-foreground">{t('home.myGroupsDesc')}</p>
              </div>
              <span className="text-muted-foreground">›</span>
            </div>
          </Link>

          <Link to="/tournament" className="block">
            <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-4 hover:border-accent/40 hover:bg-accent/5 transition-all">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <span className="text-2xl">🏆</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{t('home.tournamentPicks')}</p>
                <p className="text-xs text-muted-foreground">{t('home.tournamentPicksDesc')}</p>
              </div>
              <span className="text-muted-foreground">›</span>
            </div>
          </Link>
        </div>

        {/* Scoring rules */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h3 className="text-sm font-bold text-center">{t('home.scoringTitle')}</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <span className="text-lg font-black text-primary block">5</span>
              <span className="text-[10px] text-muted-foreground">{t('scoring.exact')}</span>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <span className="text-lg font-black text-primary block">3</span>
              <span className="text-[10px] text-muted-foreground">{t('scoring.goalDiff')}</span>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <span className="text-lg font-black text-primary block">1</span>
              <span className="text-[10px] text-muted-foreground">{t('scoring.outcome')}</span>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <span className="text-lg font-black text-accent-foreground block">×2</span>
              <span className="text-[10px] text-muted-foreground">{t('scoring.jokerMultiplier')}</span>
            </div>
          </div>
          <div className="bg-amber-900/30 rounded-lg p-2.5 text-center border border-amber-700/30">
            <span className="text-sm font-bold text-amber-400">+2</span>
            <span className="text-xs text-amber-400/80 ms-2">{t('scoring.advancerBonus')}</span>
          </div>
        </div>

        {/* Group standings */}
        {groupStandings && groupStandings.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h3 className="text-sm font-bold text-center">{t('home.yourPosition')}</h3>
            <div className="space-y-2">
              {groupStandings.map((gs) => (
                <Link key={gs.groupId} to={`/groups/${gs.groupId}`} className="block">
                  <div className="bg-muted/30 rounded-xl p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-primary">
                        {gs.rank > 0 ? (gs.rank === 1 ? '🥇' : gs.rank === 2 ? '🥈' : gs.rank === 3 ? '🥉' : `#${gs.rank}`) : '—'}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{gs.groupName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {gs.rank > 0
                            ? `${gs.rank}/${gs.totalMembers}`
                            : lang === 'he' ? 'אין ניקוד עדיין' : 'No scores yet'}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-primary">{gs.points} {t('leaderboard.points')}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <HowToPlayModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}
