import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useJokerBudget } from '@/hooks/useJokerBudget';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const { user, loading } = useRequireAuth();
  const { data: jokerBudget } = useJokerBudget();

  if (loading) return <p className="p-6">{t('common.loading')}</p>;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const toggleLang = () => {
    const next = i18n.language === 'he' ? 'en' : 'he';
    i18n.changeLanguage(next);
  };

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      {/* Top bar */}
      <header className="flex items-center justify-between p-4 max-w-lg mx-auto">
        <button
          onClick={toggleLang}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
        >
          {t('nav.switchLang')}
        </button>
        <button
          onClick={handleSignOut}
          className="text-sm text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-muted"
        >
          {t('nav.signOut')}
        </button>
      </header>

      <div className="max-w-lg mx-auto px-4 pb-10 space-y-6">
        {/* Hero */}
        <div className="text-center space-y-2 pt-2 pb-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
            <span className="text-3xl">⚽</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            {t('app.name')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('home.welcome')}, <span className="font-medium text-foreground">{displayName}</span>
          </p>
        </div>

        {/* Joker budget pill */}
        {jokerBudget && (
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 bg-accent/15 text-accent-foreground rounded-full px-4 py-1.5 text-sm font-medium border border-accent/30">
              <span>🃏</span>
              <span>
                {jokerBudget.remaining > 0
                  ? t('joker.remaining_other', { count: jokerBudget.remaining })
                  : t('joker.capReached')}
              </span>
            </div>
          </div>
        )}

        {/* Quick action cards */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
            {t('home.quickActions')}
          </h2>

          <Link to="/matches" className="block">
            <Card className="border-primary/20 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <span className="text-xl">📋</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{t('home.predictMatches')}</p>
                  <p className="text-xs text-muted-foreground">{t('home.predictMatchesDesc')}</p>
                </div>
                <span className="text-muted-foreground text-lg group-hover:text-primary transition-colors">›</span>
              </CardContent>
            </Card>
          </Link>

          <Link to="/groups" className="block">
            <Card className="border-primary/20 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <span className="text-xl">👥</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{t('home.myGroups')}</p>
                  <p className="text-xs text-muted-foreground">{t('home.myGroupsDesc')}</p>
                </div>
                <span className="text-muted-foreground text-lg group-hover:text-primary transition-colors">›</span>
              </CardContent>
            </Card>
          </Link>

          <Link to="/tournament" className="block">
            <Card className="border-primary/20 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-accent/15 flex items-center justify-center shrink-0 group-hover:bg-accent/25 transition-colors">
                  <span className="text-xl">🏆</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{t('home.tournamentPicks')}</p>
                  <p className="text-xs text-muted-foreground">{t('home.tournamentPicksDesc')}</p>
                </div>
                <span className="text-muted-foreground text-lg group-hover:text-primary transition-colors">›</span>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Scoring rules */}
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span>📊</span> {t('home.scoringTitle')}
            </h3>
            <div className="grid grid-cols-1 gap-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('home.scoringExact').split('=')[0]}</span>
                <span className="font-bold text-primary">5 {t('leaderboard.points')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('home.scoringDiff').split('=')[0]}</span>
                <span className="font-bold text-primary">3 {t('leaderboard.points')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('home.scoringOutcome').split('=')[0]}</span>
                <span className="font-bold text-primary">1 {t('leaderboard.points')}</span>
              </div>
              <div className="border-t pt-1.5 mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">{t('home.scoringJoker')}</span>
                <span className="font-bold text-accent-foreground">×2</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('home.scoringAdvancer').split('=')[0]}</span>
                <span className="font-bold text-primary">+2</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How it works */}
        <Card className="bg-muted/30">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <span>💡</span> {t('home.howItWorks')}
            </h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                {t('home.step1')}
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                {t('home.step2')}
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                {t('home.step3')}
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
