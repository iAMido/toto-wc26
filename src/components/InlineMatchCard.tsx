import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useJokerBudget, useInvalidateJokerBudget } from '@/hooks/useJokerBudget';
import { supabase } from '@/lib/supabase';
import { getFlag, getTeamName, getCode } from '@/lib/team-utils';

/* ---------- constants ---------- */

const KNOCKOUT_STAGES = new Set(['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL']);
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

/* ---------- types ---------- */

export interface MatchData {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  stage: string;
  status: string;
  home_score_120: number | null;
  away_score_120: number | null;
  advancer_team_id?: string | null;
}

export interface PredictionData {
  match_id: string;
  home: number;
  away: number;
  joker_used: boolean;
  points: number | null;
  advancer_team_id?: string | null;
}

interface Props {
  match: MatchData;
  prediction?: PredictionData;
  userId: string;
  expanded: boolean;
  onToggle: () => void;
}

/* ---------- component ---------- */

export default function InlineMatchCard({ match, prediction, userId, expanded, onToggle }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();
  const invalidateJoker = useInvalidateJokerBudget();
  const { data: jokerBudget } = useJokerBudget();
  const cardRef = useRef<HTMLDivElement>(null);

  /* ---- form state ---- */
  const [homeScore, setHomeScore] = useState(prediction ? String(prediction.home) : '');
  const [awayScore, setAwayScore] = useState(prediction ? String(prediction.away) : '');
  const [jokerUsed, setJokerUsed] = useState(prediction?.joker_used ?? false);
  const [advancer, setAdvancer] = useState<string | null>(prediction?.advancer_team_id ?? null);
  const [activeInput, setActiveInput] = useState<'home' | 'away' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Sync from prediction prop
  useEffect(() => {
    if (prediction) {
      setHomeScore(String(prediction.home));
      setAwayScore(String(prediction.away));
      setJokerUsed(prediction.joker_used);
      setAdvancer(prediction.advancer_team_id ?? null);
    }
  }, [prediction]);

  // Auto-select home input on expand
  useEffect(() => {
    if (expanded && !isLocked) {
      setActiveInput('home');
    } else if (!expanded) {
      setActiveInput(null);
      setMsg(null);
    }
  }, [expanded]);

  // Scroll into view on expand
  useEffect(() => {
    if (expanded && cardRef.current) {
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }, [expanded]);

  /* ---- derived state ---- */

  const now = new Date();
  const kickoff = new Date(match.kickoff_at);
  const isLocked = now >= kickoff || FINISHED_STATUSES.has(match.status);
  const isKnockout = KNOCKOUT_STAGES.has(match.stage);
  const isFinished = FINISHED_STATUSES.has(match.status);
  const hNum = parseInt(homeScore, 10);
  const aNum = parseInt(awayScore, 10);
  const isDraw = !isNaN(hNum) && !isNaN(aNum) && hNum === aNum;
  const needsAdvancer = isKnockout && isDraw && !isLocked;

  const jokerOnThis = jokerBudget?.jokerMatchIds.has(match.id) ?? false;
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

  // Countdown
  const diffMs = kickoff.getTime() - now.getTime();
  const getCountdownStr = (): string | null => {
    if (diffMs <= 0) return null;
    const d = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const h = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diffMs / (1000 * 60)) % 60);
    const dL = lang === 'he' ? 'י׳' : 'd';
    const hL = lang === 'he' ? 'ש׳' : 'h';
    const mL = lang === 'he' ? 'ד׳' : 'm';
    if (d > 0) return `${d}${dL} ${h}${hL}`;
    if (h > 0) return `${h}${hL} ${m}${mL}`;
    return `${m}${mL}`;
  };
  const countdown = getCountdownStr();

  // Date/time formatting
  const dateStr = kickoff.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
  const timeStr = kickoff.toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', {
    hour: '2-digit', minute: '2-digit',
  });

  /* ---- number pad handler ---- */

  const handleNumberTap = (num: number) => {
    if (isLocked) return;
    if (activeInput === 'away') {
      setAwayScore(String(num));
      setActiveInput(null);
    } else {
      // 'home' or null — set home and advance
      setHomeScore(String(num));
      setActiveInput('away');
    }
  };

  const handleClear = () => {
    if (activeInput === 'away') {
      setAwayScore('');
    } else if (activeInput === 'home') {
      setHomeScore('');
    } else {
      setHomeScore('');
      setAwayScore('');
      setActiveInput('home');
    }
  };

  /* ---- mutation ---- */

  const submit = useMutation({
    mutationFn: async () => {
      const h = parseInt(homeScore, 10);
      const a = parseInt(awayScore, 10);
      const payload: Record<string, unknown> = {
        user_id: userId,
        match_id: match.id,
        home: h,
        away: a,
        joker_used: jokerUsed,
        advancer_team_id: isKnockout && h === a ? advancer : null,
      };
      const { error } = await supabase
        .from('predictions')
        .upsert(payload, { onConflict: 'user_id,match_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      setMsg({ ok: true, text: t('match.saved') });
      invalidateJoker();
      queryClient.invalidateQueries({ queryKey: ['my-predictions'] });
      queryClient.invalidateQueries({ queryKey: ['prediction', match.id] });
      queryClient.invalidateQueries({ queryKey: ['match-stats'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['next-match'] });
      queryClient.invalidateQueries({ queryKey: ['match-day'] });
      // Auto-collapse after a brief pause
      setTimeout(() => {
        setMsg(null);
        onToggle();
      }, 1200);
    },
    onError: (err: Error) => {
      const locked =
        err.message.includes('row-level security') ||
        err.message.includes('violates') ||
        err.message.includes('new row');
      setMsg({ ok: false, text: locked ? t('match.locked') : err.message });
    },
  });

  /* ---- can this card expand? ---- */
  const canExpand = !isLocked || !!prediction;

  /* ---- render ---- */
  return (
    <div
      ref={cardRef}
      className={`rounded-xl border transition-all overflow-hidden ${
        expanded
          ? 'border-primary/50 bg-card shadow-lg shadow-primary/5'
          : 'border-border/50 bg-muted/40 hover:bg-muted/60'
      }`}
    >
      {/* ====== COLLAPSED HEADER ====== */}
      <div
        onClick={() => canExpand && onToggle()}
        className={`p-3 ${canExpand ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {/* Date + time + countdown */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-muted-foreground">
            {dateStr} · {timeStr}
          </span>
          {!isLocked && countdown && (
            <span className="text-[10px] text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
              {countdown}
            </span>
          )}
          {isLocked && !isFinished && (
            <span className="text-[10px] text-yellow-400 font-medium bg-yellow-400/10 px-2 py-0.5 rounded-full">
              🔒 {t('match.status.locked')}
            </span>
          )}
          {isFinished && (
            <span className="text-[10px] text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full">
              {match.status}
            </span>
          )}
        </div>

        {/* Teams row */}
        <div className="flex items-center justify-between gap-2">
          {/* Home team */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-2xl shrink-0">{getFlag(match.home_team)}</span>
            <span className="text-xs font-bold truncate">{getTeamName(match.home_team, lang)}</span>
          </div>

          {/* Score / VS / Prediction */}
          <div className="flex items-center gap-1.5 shrink-0 mx-1">
            {isFinished && match.home_score_120 != null ? (
              <>
                <span className="text-lg font-black">{match.home_score_120}</span>
                <span className="text-xs text-muted-foreground">:</span>
                <span className="text-lg font-black">{match.away_score_120}</span>
              </>
            ) : prediction ? (
              <>
                <span className="text-lg font-bold text-primary">{prediction.home}</span>
                <span className="text-xs text-muted-foreground">:</span>
                <span className="text-lg font-bold text-primary">{prediction.away}</span>
                {prediction.joker_used && <span className="text-xs ms-0.5">🃏</span>}
              </>
            ) : (
              <span className="vs-badge text-[10px]">VS</span>
            )}
          </div>

          {/* Away team */}
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span className="text-xs font-bold truncate text-end">{getTeamName(match.away_team, lang)}</span>
            <span className="text-2xl shrink-0">{getFlag(match.away_team)}</span>
          </div>
        </div>

        {/* Points badge (scored) */}
        {isFinished && prediction?.points != null && (
          <div className="text-center mt-1.5">
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              +{prediction.points} {t('leaderboard.points')}
            </span>
          </div>
        )}

        {/* "Tap to predict" hint for open, unpredicted matches */}
        {!isLocked && !prediction && !expanded && (
          <p className="text-center text-[10px] text-primary/60 mt-1.5">{t('match.tapToPredict')}</p>
        )}
      </div>

      {/* ====== EXPANDED CONTENT ====== */}
      {expanded && (
        <div className="px-3 pb-4 border-t border-border/50 pt-4 space-y-4">
          {!isLocked ? (
            /* ---------- PREDICTION FORM ---------- */
            <>
              {/* Team display: flags + codes + Hebrew names */}
              <div className="flex items-center justify-between px-4">
                <div className="text-center flex-1">
                  <span className="text-4xl block">{getFlag(match.home_team)}</span>
                  <span className="text-sm font-black block mt-1">{getCode(match.home_team)}</span>
                  <span className="text-[10px] text-muted-foreground block">{getTeamName(match.home_team, lang)}</span>
                </div>
                <span className="text-xs font-bold text-muted-foreground/50">vs</span>
                <div className="text-center flex-1">
                  <span className="text-4xl block">{getFlag(match.away_team)}</span>
                  <span className="text-sm font-black block mt-1">{getCode(match.away_team)}</span>
                  <span className="text-[10px] text-muted-foreground block">{getTeamName(match.away_team, lang)}</span>
                </div>
              </div>

              {/* Score circles (tappable) */}
              <div className="flex items-center justify-center gap-5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setActiveInput('home'); }}
                  className={`score-circle-lg ${
                    activeInput === 'home' ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''
                  } ${homeScore !== '' ? 'bg-primary text-primary-foreground border-primary' : ''}`}
                >
                  {homeScore !== '' ? homeScore : '-'}
                </button>

                <span className="text-xl font-bold text-muted-foreground">:</span>

                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setActiveInput('away'); }}
                  className={`score-circle-lg ${
                    activeInput === 'away' ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''
                  } ${awayScore !== '' ? 'bg-primary text-primary-foreground border-primary' : ''}`}
                >
                  {awayScore !== '' ? awayScore : '-'}
                </button>
              </div>

              {/* Number pad */}
              <div className="space-y-1.5 max-w-[280px] mx-auto">
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleNumberTap(n); }}
                      className="numpad-btn"
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[6, 7, 8, 9, 0].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleNumberTap(n); }}
                      className="numpad-btn"
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleClear(); }}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-3 py-1"
                  >
                    {lang === 'he' ? 'נקה' : 'Clear'}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">
                  {t('match.numpadHint')}
                </p>
              </div>

              {/* Joker toggle */}
              <div
                className="flex items-center justify-between p-3 rounded-xl bg-muted/60 border border-border/50"
                onClick={(e) => e.stopPropagation()}
              >
                <div>
                  <p className="text-sm font-medium">{t('joker.label')}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {jokerBudget
                      ? jokerBudget.remaining > 0
                        ? t('joker.remaining', { count: jokerBudget.remaining })
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
                    ${jokerUsed ? 'bg-primary' : 'bg-muted-foreground/30'}
                    ${jokerDisabled && !jokerUsed ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                  title={t('joker.tooltip')}
                >
                  <span
                    className={`
                      pointer-events-none block h-5 w-5 rounded-full bg-white shadow mt-1 transition-transform
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

              {/* Advancer picker (knockout draw) */}
              {needsAdvancer && (
                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs font-medium text-center">{t('match.advancer')}</p>
                  <p className="text-[10px] text-muted-foreground text-center">{t('match.advancerHint')}</p>
                  <div className="flex gap-2">
                    {[match.home_team, match.away_team].map((team) => (
                      <button
                        key={team}
                        type="button"
                        onClick={() => setAdvancer(team)}
                        className={`flex-1 p-2.5 rounded-xl border text-center transition-all ${
                          advancer === team
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <span className="text-2xl block mb-0.5">{getFlag(team)}</span>
                        <span className="text-[10px] font-medium">{getTeamName(team, lang)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback message */}
              {msg && (
                <div
                  className={`text-sm p-2.5 rounded-xl text-center font-medium ${
                    msg.ok ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                  }`}
                >
                  {msg.text}
                </div>
              )}

              {/* Save button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  submit.mutate();
                }}
                disabled={!canSubmit || submit.isPending}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm
                  disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
              >
                {submit.isPending
                  ? (lang === 'he' ? 'שומר...' : 'Saving...')
                  : prediction
                    ? t('match.update')
                    : t('match.submit')}
              </button>
            </>
          ) : prediction ? (
            /* ---------- LOCKED / SCORED: prediction summary ---------- */
            <div className="space-y-3">
              {/* User's prediction */}
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  {t('match.prediction')}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-lg">{getFlag(match.home_team)}</span>
                  <span className="text-2xl font-bold text-primary">{prediction.home}</span>
                  <span className="text-muted-foreground">:</span>
                  <span className="text-2xl font-bold text-primary">{prediction.away}</span>
                  <span className="text-lg">{getFlag(match.away_team)}</span>
                </div>
                {prediction.joker_used && (
                  <p className="text-xs mt-1">🃏 {t('joker.active')}</p>
                )}
                {prediction.advancer_team_id && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {t('match.advancer')}: {getFlag(prediction.advancer_team_id)} {getTeamName(prediction.advancer_team_id, lang)}
                  </p>
                )}
              </div>

              {/* Points breakdown (if scored) */}
              {prediction.points != null && match.home_score_120 != null && (() => {
                const predH = prediction.home;
                const predA = prediction.away;
                const actH = match.home_score_120!;
                const actA = match.away_score_120!;

                const isExact = predH === actH && predA === actA;
                const isGoalDiff = !isExact && (predH - predA) === (actH - actA);
                const predOutcome = predH > predA ? '1' : predH < predA ? '2' : 'X';
                const actOutcome = actH > actA ? '1' : actH < actA ? '2' : 'X';
                const isOutcome = !isExact && !isGoalDiff && predOutcome === actOutcome;

                let basePoints = 0;
                let baseLabel = t('scoring.wrong');
                let baseColor = 'text-muted-foreground';
                if (isExact) { basePoints = 5; baseLabel = t('scoring.exact'); baseColor = 'text-primary'; }
                else if (isGoalDiff) { basePoints = 3; baseLabel = t('scoring.goalDiff'); baseColor = 'text-primary'; }
                else if (isOutcome) { basePoints = 1; baseLabel = t('scoring.outcome'); baseColor = 'text-primary'; }

                const jokerMultiplied = prediction.joker_used ? basePoints * 2 : basePoints;
                const hasAdvancerBonus =
                  match.status === 'PEN' &&
                  prediction.advancer_team_id === match.advancer_team_id &&
                  prediction.advancer_team_id != null;
                const total = jokerMultiplied + (hasAdvancerBonus ? 2 : 0);

                return (
                  <div className="space-y-1.5 pt-2 border-t border-border/50">
                    <h4 className="text-[10px] font-bold text-center text-muted-foreground uppercase tracking-wider">
                      {t('pointsBreakdown.title')}
                    </h4>
                    <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-1.5">
                      <span className="text-xs text-muted-foreground">{baseLabel}</span>
                      <span className={`text-sm font-bold ${baseColor}`}>+{basePoints}</span>
                    </div>
                    {prediction.joker_used && (
                      <div className="flex items-center justify-between bg-amber-900/20 rounded-lg px-3 py-1.5 border border-amber-700/20">
                        <span className="text-xs text-amber-400">🃏 {t('pointsBreakdown.jokerApplied')}</span>
                        <span className="text-sm font-bold text-amber-400">= {jokerMultiplied}</span>
                      </div>
                    )}
                    {hasAdvancerBonus && (
                      <div className="flex items-center justify-between bg-emerald-900/20 rounded-lg px-3 py-1.5 border border-emerald-700/20">
                        <span className="text-xs text-emerald-400">{t('pointsBreakdown.advancerCorrect')}</span>
                        <span className="text-sm font-bold text-emerald-400">+2</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between bg-primary/10 rounded-lg px-3 py-2 border border-primary/20">
                      <span className="text-sm font-bold">{t('pointsBreakdown.total')}</span>
                      <span className="text-xl font-black text-primary">+{total}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* ---------- LOCKED, NO PREDICTION ---------- */
            <p className="text-center text-sm text-muted-foreground py-2">
              {t('match.locked')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
