import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useJokerBudget, useInvalidateJokerBudget } from '@/hooks/useJokerBudget';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { getFlag, getTeamName } from '@/lib/team-utils';

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
      const locked =
        err.message.includes('row-level security') ||
        err.message.includes('violates') ||
        err.message.includes('new row');
      setMsg({ ok: false, text: locked ? t('match.locked') : err.message });
    },
  });

  /* ---- loading / error states ---- */

  if (authLoading || matchLoading || predLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <span className="text-3xl">⚽</span>
          <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
        </div>
      </div>
    );
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

  const stageLabel = t(`stages.${match.stage}`, { defaultValue: match.stage.replace('_', ' ') });

  const kickoffLabel = kickoff.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Countdown
  const diffMs = kickoff.getTime() - now.getTime();
  const daysLeft = diffMs > 0 ? Math.floor(diffMs / (1000 * 60 * 60 * 24)) : 0;

  /* ---- render ---- */

  return (
    <div className="min-h-screen">
      <div className="max-w-lg mx-auto px-4 pb-4 space-y-5">
        {/* Back nav */}
        <div className="flex items-center pt-4">
          <Link to="/matches" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← {t('common.back')}
          </Link>
        </div>

        {/* Stage + Date header */}
        <div className="text-center space-y-1">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
            match.stage.startsWith('GROUP_')
              ? 'bg-emerald-900/60 text-emerald-400 border border-emerald-700/50'
              : 'bg-amber-900/60 text-amber-400 border border-amber-700/50'
          }`}>
            {stageLabel}
          </span>
          <p className="text-sm text-muted-foreground">{kickoffLabel}</p>
          {!isLocked && daysLeft > 0 && (
            <p className="text-xs text-primary">
              {daysLeft} {lang === 'he' ? 'ימים' : daysLeft === 1 ? 'day' : 'days'}
            </p>
          )}
        </div>

        {/* Match card with teams */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between gap-3">
            {/* Home team */}
            <div className="flex-1 text-center">
              <span className="text-4xl block mb-2">{getFlag(match.home_team)}</span>
              <span className="text-sm font-bold block">{getTeamName(match.home_team, lang)}</span>
            </div>

            {/* VS / Score */}
            <div className="flex flex-col items-center gap-1">
              {match.home_score_120 != null ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-black">{match.home_score_120}</span>
                    <span className="text-lg text-muted-foreground">:</span>
                    <span className="text-3xl font-black">{match.away_score_120}</span>
                  </div>
                  {match.status !== 'FT' && (
                    <span className="text-xs text-amber-400 font-medium">{match.status}</span>
                  )}
                </>
              ) : (
                <span className="vs-badge text-sm">VS</span>
              )}
            </div>

            {/* Away team */}
            <div className="flex-1 text-center">
              <span className="text-4xl block mb-2">{getFlag(match.away_team)}</span>
              <span className="text-sm font-bold block">{getTeamName(match.away_team, lang)}</span>
            </div>
          </div>

          {isLocked && (
            <div className="text-center mt-3 pt-3 border-t border-border">
              <span className="text-xs text-destructive font-medium">{t('match.locked')}</span>
            </div>
          )}
        </div>

        {/* Prediction form */}
        <div className="bg-card rounded-2xl border border-border p-5 space-y-5">
          <h3 className="text-center font-bold text-sm">{t('match.prediction')}</h3>

          {/* Score inputs — circular style */}
          <div className="flex items-center justify-center gap-6">
            <div className="text-center space-y-1">
              <span className="text-xs text-muted-foreground">{getTeamName(match.home_team, lang)}</span>
              <input
                type="number"
                min={0}
                max={30}
                value={homeScore}
                onChange={(e) => setHomeScore(e.target.value)}
                className="score-circle"
                disabled={isLocked}
                placeholder="-"
              />
            </div>

            <span className="text-lg font-bold text-muted-foreground mt-4">:</span>

            <div className="text-center space-y-1">
              <span className="text-xs text-muted-foreground">{getTeamName(match.away_team, lang)}</span>
              <input
                type="number"
                min={0}
                max={30}
                value={awayScore}
                onChange={(e) => setAwayScore(e.target.value)}
                className="score-circle"
                disabled={isLocked}
                placeholder="-"
              />
            </div>
          </div>

          {/* Joker toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/50">
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

            <button
              dir="ltr"
              type="button"
              role="switch"
              aria-checked={jokerUsed}
              onClick={() => setJokerUsed((v) => !v)}
              disabled={jokerDisabled && !jokerUsed}
              className={`
                relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                ${jokerUsed ? 'bg-primary' : 'bg-muted-foreground/30'}
                ${jokerDisabled && !jokerUsed ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              `}
              title={t('joker.tooltip')}
            >
              <span
                className={`
                  pointer-events-none block h-5 w-5 rounded-full bg-white shadow ring-0
                  transition-transform mt-1
                  ${jokerUsed ? 'translate-x-[1.375rem]' : 'translate-x-1'}
                `}
              />
            </button>
          </div>

          {jokerUsed && (
            <p className="text-sm text-primary font-semibold text-center">
              🃏 {t('joker.active')}
            </p>
          )}

          {/* Advancer picker (knockout draw only) */}
          {needsAdvancer && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-center">{t('match.advancer')}</p>
              <p className="text-xs text-muted-foreground text-center">{t('match.advancerHint')}</p>
              <div className="flex gap-3">
                {[match.home_team, match.away_team].map((team) => (
                  <button
                    key={team}
                    type="button"
                    onClick={() => setAdvancer(team)}
                    disabled={isLocked}
                    className={`
                      flex-1 p-3 rounded-xl border text-center transition-all
                      ${advancer === team
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border hover:bg-muted/50'}
                    `}
                  >
                    <span className="text-2xl block mb-1">{getFlag(team)}</span>
                    <span className="text-xs font-medium">{getTeamName(team, lang)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Feedback message */}
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

          {/* Submit button */}
          <Button
            onClick={() => submit.mutate()}
            disabled={!canSubmit || submit.isPending}
            className="w-full rounded-xl h-12 text-base font-bold"
          >
            {existing ? t('match.update') : t('match.submit')}
          </Button>
        </div>

        {/* Existing prediction summary when locked */}
        {isLocked && existing && (
          <div className="bg-card rounded-2xl border border-border p-5 space-y-2">
            <h3 className="text-center font-bold text-sm text-muted-foreground">{t('match.prediction')}</h3>
            <div className="flex items-center justify-center gap-4">
              <span className="text-lg">{getFlag(match.home_team)}</span>
              <span className="text-2xl font-bold">{existing.home}</span>
              <span className="text-muted-foreground">:</span>
              <span className="text-2xl font-bold">{existing.away}</span>
              <span className="text-lg">{getFlag(match.away_team)}</span>
            </div>
            {existing.joker_used && <p className="text-center text-sm">🃏 {t('joker.active')}</p>}
            {existing.advancer_team_id && (
              <p className="text-center text-xs text-muted-foreground">
                {t('match.advancer')}: {getFlag(existing.advancer_team_id)} {getTeamName(existing.advancer_team_id, lang)}
              </p>
            )}
            {existing.points != null && (
              <p className="text-center font-bold text-primary text-lg">
                +{existing.points} {t('leaderboard.points')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
