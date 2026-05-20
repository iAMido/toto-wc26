import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useJokerBudget } from '@/hooks/useJokerBudget';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user, loading: authLoading } = useRequireAuth();
  const { data: jokerBudget } = useJokerBudget();
  const queryClient = useQueryClient();

  // Display-name edit state
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Initialise draft from current user; auto-focus input when entering edit mode
  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const saveName = useMutation({
    mutationFn: async (newName: string) => {
      const trimmed = newName.trim();
      if (trimmed.length < 2) throw new Error('TOO_SHORT');
      // Write to BOTH auth metadata (for client display) and public.users
      // (for leaderboard joins). RLS lets users update their own row.
      const [authRes, dbRes] = await Promise.all([
        supabase.auth.updateUser({ data: { display_name: trimmed } }),
        supabase.from('users').update({ display_name: trimmed }).eq('id', user!.id),
      ]);
      if (authRes.error) throw authRes.error;
      if (dbRes.error) throw dbRes.error;
      return trimmed;
    },
    onSuccess: () => {
      setNameMsg({ ok: true, text: t('profile.nameSaved') });
      setEditingName(false);
      // Refresh anything that displays the name
      queryClient.invalidateQueries({ queryKey: ['group-members'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['home-standings'] });
      setTimeout(() => setNameMsg(null), 2500);
    },
    onError: (err: Error) => {
      const msg = err.message === 'TOO_SHORT' ? t('profile.nameTooShort') : err.message;
      setNameMsg({ ok: false, text: msg });
      setTimeout(() => setNameMsg(null), 3500);
    },
  });

  // Prediction stats
  const { data: stats } = useQuery({
    queryKey: ['profile-stats', user?.id],
    queryFn: async () => {
      const [
        { count: totalMatches },
        { count: totalPreds },
        { data: scoredPreds },
        { count: groupCount },
        { data: tournamentPred },
      ] = await Promise.all([
        supabase.from('matches').select('id', { count: 'exact', head: true }),
        supabase.from('predictions').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('predictions').select('points').eq('user_id', user!.id).not('points', 'is', null),
        supabase.from('group_members').select('group_id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('tournament_predictions').select('champion_team, top_scorer_player_id').eq('user_id', user!.id).maybeSingle(),
      ]);

      const totalPoints = (scoredPreds ?? []).reduce((sum, p) => sum + (p.points ?? 0), 0);
      const scoredCount = scoredPreds?.length ?? 0;
      const exactCount = (scoredPreds ?? []).filter((p) => p.points !== null && p.points >= 5).length;
      const avgPoints = scoredCount > 0 ? (totalPoints / scoredCount).toFixed(1) : '0';

      return {
        totalMatches: totalMatches ?? 0,
        totalPredictions: totalPreds ?? 0,
        scoredMatches: scoredCount,
        totalPoints,
        exactScores: exactCount,
        avgPointsPerMatch: avgPoints,
        groupCount: groupCount ?? 0,
        hasTournamentPicks: !!(tournamentPred?.champion_team || tournamentPred?.top_scorer_player_id),
      };
    },
    enabled: !!user,
  });

  if (authLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="text-center space-y-2">
          <span className="text-3xl">👤</span>
          <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || '';
  const email = user?.email ?? '';
  const initial = (displayName || '?')[0].toUpperCase();
  const completionPct = stats
    ? Math.round((stats.totalPredictions / Math.max(stats.totalMatches, 1)) * 100)
    : 0;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const toggleLang = () => {
    const next = i18n.language === 'he' ? 'en' : 'he';
    i18n.changeLanguage(next);
  };

  return (
    <div className="min-h-[100dvh]">
      <div className="max-w-lg mx-auto px-4 pb-4 space-y-4">
        {/* Header */}
        <div className="text-center pt-6 pb-2">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary mx-auto mb-3">
            {initial}
          </div>

          {/* Name display / edit toggle */}
          {!editingName ? (
            <div className="inline-flex items-center gap-2">
              <h1 className="text-xl font-bold">{displayName}</h1>
              <button
                type="button"
                onClick={() => { setNameDraft(displayName); setEditingName(true); }}
                className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1.5 py-0.5"
                aria-label={t('profile.editName')}
              >
                ✏ {t('profile.editName')}
              </button>
            </div>
          ) : (
            <div className="max-w-xs mx-auto space-y-2 text-start">
              <label className="text-xs text-muted-foreground block">{t('profile.displayName')}</label>
              <Input
                ref={nameInputRef}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); saveName.mutate(nameDraft); }
                  if (e.key === 'Escape') { setEditingName(false); setNameMsg(null); }
                }}
                maxLength={40}
                className="rounded-xl bg-muted/50 text-center text-lg font-bold"
                aria-label={t('profile.displayName')}
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => saveName.mutate(nameDraft)}
                  disabled={saveName.isPending || nameDraft.trim().length < 2}
                  className="flex-1 rounded-xl h-10 text-sm font-bold"
                >
                  {t('profile.saveName')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setEditingName(false); setNameMsg(null); }}
                  className="rounded-xl h-10 text-sm"
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          )}

          {nameMsg && (
            <p className={`text-xs mt-2 ${nameMsg.ok ? 'text-primary' : 'text-destructive'}`} role="status">
              {nameMsg.text}
            </p>
          )}

          <p className="text-xs text-muted-foreground mt-1" dir="ltr">{email}</p>
        </div>

        {/* Completion progress */}
        {stats && (
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">
                {lang === 'he' ? 'מוכנות למונדיאל' : 'World Cup Readiness'}
              </span>
              <span className="text-sm font-bold text-primary">{completionPct}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {stats.totalPredictions}/{stats.totalMatches} {lang === 'he' ? 'משחקים נוחשו' : 'matches predicted'}
            </p>
          </div>
        )}

        {/* Stats grid */}
        {stats && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-2xl border border-border p-4 text-center">
              <span className="text-2xl font-black text-primary block">{stats.totalPoints}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {lang === 'he' ? 'סה״כ נקודות' : 'Total Points'}
              </span>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4 text-center">
              <span className="text-2xl font-black block">{stats.avgPointsPerMatch}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {lang === 'he' ? 'ממוצע למשחק' : 'Avg per Match'}
              </span>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4 text-center">
              <span className="text-2xl font-black text-emerald-400 block">{stats.exactScores}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {lang === 'he' ? 'תוצאות מדויקות' : 'Exact Scores'}
              </span>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4 text-center">
              <span className="text-2xl font-black block">
                {jokerBudget ? `${jokerBudget.used}/3` : '0/3'}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {lang === 'he' ? "ג׳וקרים שומשו" : 'Jokers Used'}
              </span>
            </div>
          </div>
        )}

        {/* Quick info */}
        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          <div className="p-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {lang === 'he' ? 'קבוצות' : 'Groups'}
            </span>
            <span className="text-sm font-bold">{stats?.groupCount ?? 0}</span>
          </div>
          <div className="p-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {lang === 'he' ? 'ניחושי טורניר' : 'Tournament Picks'}
            </span>
            <span className="text-sm font-bold">
              {stats?.hasTournamentPicks
                ? (lang === 'he' ? '✅ הוגשו' : '✅ Submitted')
                : (lang === 'he' ? '❌ חסרים' : '❌ Missing')}
            </span>
          </div>
          <div className="p-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {lang === 'he' ? 'משחקים שחושבו' : 'Scored Matches'}
            </span>
            <span className="text-sm font-bold">{stats?.scoredMatches ?? 0}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <button
            onClick={toggleLang}
            className="w-full bg-card rounded-2xl border border-border p-4 text-sm text-start hover:bg-muted/50 transition-colors flex items-center justify-between"
          >
            <span>{lang === 'he' ? 'שפה' : 'Language'}</span>
            <span className="text-muted-foreground">{t('nav.switchLang')}</span>
          </button>

          <button
            onClick={handleSignOut}
            className="w-full bg-card rounded-2xl border border-destructive/30 p-4 text-sm text-destructive text-center hover:bg-destructive/5 transition-colors"
          >
            {t('nav.signOut')}
          </button>
        </div>
      </div>
    </div>
  );
}
