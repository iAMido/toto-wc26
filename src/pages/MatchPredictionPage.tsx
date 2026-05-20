import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useJokerBudget, useInvalidateJokerBudget } from '@/hooks/useJokerBudget';
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

/* ---------- constants ---------- */

const KNOCKOUT_STAGES = new Set(['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL']);
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

/* ---------- component ---------- */

export default function MatchPredictionPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { id: matchId } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useRequireAuth();
  const queryClient = useQueryClient();
  const invalidateJoker = useInvalidateJokerBudget();

  const { data: jokerBudget } = useJokerBudget();

  // Form state
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [jokerUsed, setJokerUsed] = useState(false);
  const [advancer, setAdvancer] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  /* ---- data queries ---- */

  const { data: match, isLoading: matchLoading } = useQuery({
    queryKey: ['match', matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!matchId && !!user,
  });

  const { data: existing, isLoading: predLoading } = useQuery({
    queryKey: ['prediction', matchId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('predictions')
        .select('*')
        .eq('match_id', matchId!)
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!matchId && !!user,
  });

  // Seed form from existing prediction
  useEffect(() => {
    if (existing) {
      setHomeScore(String(existing.home));
      setAwayScore(String(existing.away));
      setJokerUsed(existing.joker_used);
      setAdvancer(existing.advancer_team_id);
    }
  }, [existing]);

  /* ---- mutation ---- */

  const submit = useMutation({
    mutationFn: async () => {
      const h = parseInt(homeScore, 10);
      const a = parseInt(awayScore, 10);
      const isKO = match && KNOCKOUT_STAGES.has(match.stage);
      const isDraw = h === a;

      const payload: Record<string, unknown> = {
        user_id: user!.id,
        match_id: matchId!,
        home: h,
        away: a,
        joker_used: jokerUsed,
        advancer_team_id: isKO && isDraw ? advancer : null,
      };

      const { error } = await supabase
        .from('predictions')
        .upsert(payload, { onConflict: 'user_id,match_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      setMsg({ ok: true, text: t('match.saved') });
      invalidateJoker();
      queryClient.invalidateQueries({ queryKey: ['prediction', matchId] });
      queryClient.invalidateQueries({ queryKey: ['my-predictions'] });
      queryClient.invalidateQueries({ queryKey: ['joker-budget'] });
    },
    onError: (err: Error) => {
      // RLS blocks writes past kickoff
      const locked =
        err.message.includes('row-level security') ||
        err.message.includes('violates') ||
        err.message.includes('new row');
      setMsg({ ok: false, text: locked ? t('match.locked') : err.message });
    },
  });

  /* ---- loading / error states ---- */

  if (authLoading || matchLoading || predLoading) {
    return <p className="p-6 text-center">{t('common.loading')}</p>;
  }

  if (!match) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{t('common.error')}</p>
        <Link to="/matches">
          <Button variant="outline">{t('common.back')}</Button>
        </Link>
      </div>
    );
  }

  /* ---- derived state ---- */

  const now = new Date();
  const kickoff = new Date(match.kickoff_at);
  const isLocked = now >= kickoff || FINISHED_STATUSES.has(match.status);
  const isKnockout = KNOCKOUT_STAGES.has(match.stage);
  const hNum = parseInt(homeScore, 10);
  const aNum = parseInt(awayScore, 10);
  const isDraw = !isNaN(hNum) && !isNaN(aNum) && hNum === aNum;
  const needsAdvancer = isKnockout && isDraw;

  // Joker: disabled when at cap AND this match doesn't already have joker set
  const jokerOnThis = jokerBudget?.jokerMatchIds.has(matchId!) ?? false;
  const jokerDisabled = isLocked || (!jokerOnThis && (jokerBudget?.remaining ?? 0) === 0);

  const canSubmit =
    !isLocked &&
    homeScore !== '' &&
    awayScore !== '' &&
    !isNaN(hNum) &&
    !isNaN(aNum) &&
    hNum >= 0 &&
    aNum >= 0 &&
    (!needsAdvancer || advancer != null);

  const kickoffLabel = kickoff.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  /* ---- render ---- */

  const stageLabel = t(`stages.${match.stage}`, { defaultValue: match.stage.replace('_', ' ') });

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
    <div className="max-w-lg mx-auto px-4 pb-10 space-y-6">
      {/* Nav */}
      <div className="flex items-center justify-between pt-4">
        <Link to="/matches">
          <Button variant="ghost" size="sm">{t('common.back')}</Button>
        </Link>
      </div>

      {/* Match info card */}
      <Card className="border-primary/20">
        <CardHeader className="text-center">
          <CardDescription>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mb-1 ${match.stage.startsWith('GROUP_') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
              {stageLabel}
            </span>
            <br />
            {kickoffLabel}
          </CardDescription>
          <CardTitle className="text-xl">
            {match.home_team} {t('match.vs')} {match.away_team}
          </CardTitle>

          {isLocked && (
            <p className="text-sm text-destructive font-medium mt-1">
              {t('match.locked')}
            </p>
          )}

          {/* Actual result if available */}
          {match.home_score_120 != null && (
            <p className="text-lg font-mono font-bold mt-2">
              {match.home_score_120} – {match.away_score_120}
              {match.status !== 'FT' && ` (${match.status})`}
            </p>
          )}
        </CardHeader>
      </Card>

      {/* Prediction form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('match.prediction')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Score inputs */}
          <div className="flex items-center gap-4 justify-center">
            <div className="text-center">
              <label className="text-sm text-muted-foreground block mb-1">
                {match.home_team}
              </label>
              <Input
                type="number"
                min={0}
                max={30}
                value={homeScore}
                onChange={(e) => setHomeScore(e.target.value)}
                className="w-20 text-center text-lg font-bold"
                disabled={isLocked}
              />
            </div>

            <span className="text-xl font-bold text-muted-foreground mt-5">–</span>

            <div className="text-center">
              <label className="text-sm text-muted-foreground block mb-1">
                {match.away_team}
              </label>
              <Input
                type="number"
                min={0}
                max={30}
                value={awayScore}
                onChange={(e) => setAwayScore(e.target.value)}
                className="w-20 text-center text-lg font-bold"
                disabled={isLocked}
              />
            </div>
          </div>

          {/* Joker toggle */}
          <div className="flex items-center justify-between p-3 rounded-md border">
            <div>
              <p className="text-sm font-medium">{t('joker.label')}</p>
              <p className="text-xs text-muted-foreground">
                {jokerBudget
                  ? jokerBudget.remaining > 0
                    ? t('joker.remaining_other', { count: jokerBudget.remaining })
                    : t('joker.capReached')
                  : ''}
              </p>
            </div>

            {/* Custom toggle switch — dir="ltr" so knob direction is consistent */}
            <button
              dir="ltr"
              type="button"
              role="switch"
              aria-checked={jokerUsed}
              onClick={() => setJokerUsed((v) => !v)}
              disabled={jokerDisabled && !jokerUsed}
              className={`
                relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                ${jokerUsed ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}
                ${jokerDisabled && !jokerUsed ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              title={t('joker.tooltip')}
            >
              <span
                className={`
                  pointer-events-none block h-5 w-5 rounded-full bg-white shadow ring-0
                  transition-transform mt-0.5
                  ${jokerUsed ? 'translate-x-[1.375rem]' : 'translate-x-0.5'}
                `}
              />
            </button>
          </div>

          {jokerUsed && (
            <p className="text-sm text-primary font-semibold text-center">
              {t('joker.active')}
            </p>
          )}

          {/* Advancer picker (knockout draw only) */}
          {needsAdvancer && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('match.advancer')}</p>
              <p className="text-xs text-muted-foreground">{t('match.advancerHint')}</p>
              <div className="flex gap-3">
                {[match.home_team, match.away_team].map((team) => (
                  <button
                    key={team}
                    type="button"
                    onClick={() => setAdvancer(team)}
                    disabled={isLocked}
                    className={`
                      flex-1 p-3 rounded-md border text-sm font-medium transition-colors
                      ${advancer === team
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input hover:bg-accent'}
                    `}
                  >
                    {team}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Feedback message */}
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

          {/* Submit button */}
          <Button
            onClick={() => submit.mutate()}
            disabled={!canSubmit || submit.isPending}
            className="w-full"
          >
            {existing ? t('match.update') : t('match.submit')}
          </Button>

          {/* Show existing prediction summary when locked */}
          {isLocked && existing && (
            <div className="text-center text-sm text-muted-foreground space-y-1 pt-3 border-t">
              <p>
                {t('match.prediction')}: {existing.home} – {existing.away}
              </p>
              {existing.joker_used && <p>{t('joker.active')}</p>}
              {existing.advancer_team_id && (
                <p>
                  {t('match.advancer')}: {existing.advancer_team_id}
                </p>
              )}
              {existing.points != null && (
                <p className="font-bold text-primary">
                  +{existing.points} {t('leaderboard.points')}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </div>
  );
}
