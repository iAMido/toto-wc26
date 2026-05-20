import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useJokerBudget } from '@/hooks/useJokerBudget';
import { supabase } from '@/lib/supabase';
import HowToPlayModal from '@/components/HowToPlayModal';

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user, loading } = useRequireAuth();
  const { data: jokerBudget } = useJokerBudget();
  const [rulesOpen, setRulesOpen] = useState(false);

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

  // Fetch user's groups + standings
  const { data: groupStandings } = useQuery({
    queryKey: ['home-standings', user?.id],
    queryFn: async () => {
      // Get user's groups
      const { data: memberships, error: memErr } = await supabase
        .from('group_members')
        .select('group_id, groups(id, name)')
        .eq('user_id', user!.id);
      if (memErr) throw memErr;
      if (!memberships || memberships.length === 0) return [];

      // For each group, get the leaderboard to find user's position
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

        results.push({
          groupId: g.id,
          groupName: g.name,
          rank,
          totalMembers,
          points,
        });
      }
      return results;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <span className="text-3xl">⚽</span>
          <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
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
    <div className="min-h-screen">
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
            <div className="flex justify-center gap-3">
              {[
                { val: countdown.days, label: lang === 'he' ? 'ימים' : 'Days' },
                { val: countdown.hours, label: lang === 'he' ? 'שעות' : 'Hours' },
                { val: countdown.mins, label: lang === 'he' ? 'דקות' : 'Min' },
                { val: countdown.secs, label: lang === 'he' ? 'שניות' : 'Sec' },
              ].map((item) => (
                <div key={item.label} className="countdown-box">
                  <div className="countdown-number">{String(item.val).padStart(2, '0')}</div>
                  <div className="countdown-label">{item.label}</div>
                </div>
              ))}
            </div>
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

        {/* Group standings snapshot */}
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

      {/* How to play modal */}
      <HowToPlayModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}
