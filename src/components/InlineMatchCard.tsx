import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useJokerBudget, useInvalidateJokerBudget } from '@/hooks/useJokerBudget';
import { supabase } from '@/lib/supabase';
import { getTeamName, getPlaceholderLabel } from '@/lib/team-utils';
import TeamFlag from '@/components/TeamFlag';
import { Button } from '@/components/ui/button';

/* ---------- constants ---------- */

const KNOCKOUT_STAGES = new Set(['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL']);
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);
const AUTOSAVE_DELAY = 800; // ms debounce

/* ---------- types ---------- */

export interface MatchData {
  id: string;
  home_team: string | null;
  away_team: string | null;
  home_team_placeholder?: string | null;
  away_team_placeholder?: string | null;
  match_number?: number | null;
  kickoff_at: string;
  stage: string;
  status: string;
  home_score_120: number | null;
  away_score_120: number | null;
  advancer_team_id?: string | null;
  api_fixture_id?: number | null;
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
  /** api_fixture_id → match_number map, used to resolve WIN_<id>/LOSE_<id> placeholders */
  matchNumberLookup?: Map<number, number>;
}

/* ---------- component ---------- */

export default function InlineMatchCard({ match, prediction, userId, expanded, onToggle, matchNumberLookup }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  // TBD = team unknown yet (knockout slot waiting for group-stage resolution)
  const isTbdHome = !match.home_team;
  const isTbdAway = !match.away_team;
  const isTbd = isTbdHome || isTbdAway;
  const homeLabel = isTbdHome
    ? getPlaceholderLabel(match.home_team_placeholder, lang, matchNumberLookup)
    : getTeamName(match.home_team as string, lang);
  const awayLabel = isTbdAway
    ? getPlaceholderLabel(match.away_team_placeholder, lang, matchNumberLookup)
    : getTeamName(match.away_team as string, lang);
  const queryClient = useQueryClient();
  const invalidateJoker = useInvalidateJokerBudget();
  const { data: jokerBudget } = useJokerBudget();
  const cardRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---- form state ---- */
  const [homeScore, setHomeScore] = useState<number | null>(prediction != null ? prediction.home : null);
  const [awayScore, setAwayScore] = useState<number | null>(prediction != null ? prediction.away : null);
  const [jokerUsed, setJokerUsed] = useState(prediction?.joker_used ?? false);
  const [advancer, setAdvancer] = useState<string | null>(prediction?.advancer_team_id ?? null);
  // 'error' = generic server failure; 'locked' = RLS rejected (kickoff passed);
  // 'jokerCap' = DB trigger rejected because user already has 3 jokers saved.
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'locked' | 'jokerCap'>('idle');

  // Sync from prediction prop
  useEffect(() => {
    if (prediction) {
      setHomeScore(prediction.home);
      setAwayScore(prediction.away);
      setJokerUsed(prediction.joker_used);
      setAdvancer(prediction.advancer_team_id ?? null);
    }
  }, [prediction]);

  // Scroll into view on expand
  useEffect(() => {
    if (expanded && cardRef.current) {
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
    if (!expanded) {
      setSaveStatus('idle');
    }
  }, [expanded]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, []);

  /* ---- derived state ---- */

  const now = new Date();
  const kickoff = new Date(match.kickoff_at);
  // TBD slots can never be predicted — they're locked until group stage resolves and seeds the teams
  const isLocked = isTbd || now >= kickoff || FINISHED_STATUSES.has(match.status);
  const isKnockout = KNOCKOUT_STAGES.has(match.stage);
  const isFinished = FINISHED_STATUSES.has(match.status);
  const isDraw = homeScore != null && awayScore != null && homeScore === awayScore;
  const needsAdvancer = isKnockout && isDraw && !isLocked;

  const jokerOnThis = jokerBudget?.jokerMatchIds.has(match.id) ?? false;
  // Joker is disabled in three cases:
  //   1. The match is locked (kickoff passed or TBD).
  //   2. The user has hit the 3-joker cap on OTHER matches.
  //   3. The user hasn't set a complete prediction yet — without scores
  //      there's nothing to save, so the toggle would be a no-op that
  //      misleadingly looks like an added joker.
  const scoresIncomplete = homeScore == null || awayScore == null;
  const atCap = !jokerOnThis && (jokerBudget?.remaining ?? 0) === 0;
  const jokerDisabled = isLocked || atCap || scoresIncomplete;


  // Countdown
  const diffMs = kickoff.getTime() - now.getTime();
  const getCountdownStr = (): string | null => {
    if (diffMs <= 0) return null;
    const d = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const h = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diffMs / (1000 * 60)) % 60);
    if (lang === 'he') {
      // Hebrew renders RTL; largest unit reads first (right side of chip).
      // Use full words for clarity: "3 ימים 5 שעות".
      if (d > 0) return `${d} ימים ${h} שעות`;
      if (h > 0) return `${h} שעות ${m} דקות`;
      return `${m} דקות`;
    }
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };
  const countdown = getCountdownStr();

  const dateStr = kickoff.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
  const timeStr = kickoff.toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', {
    hour: '2-digit', minute: '2-digit',
  });

  /* ---- mutation (auto-save) ---- */

  const submit = useMutation({
    mutationFn: async (payload: { home: number; away: number; joker: boolean; adv: string | null }) => {
      const p: Record<string, unknown> = {
        user_id: userId,
        match_id: match.id,
        home: payload.home,
        away: payload.away,
        joker_used: payload.joker,
        advancer_team_id: isKnockout && payload.home === payload.away ? payload.adv : null,
      };
      const { error } = await supabase
        .from('predictions')
        .upsert(p, { onConflict: 'user_id,match_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      setSaveStatus('saved');
      invalidateJoker();
      queryClient.invalidateQueries({ queryKey: ['my-predictions'] });
      queryClient.invalidateQueries({ queryKey: ['match-stats'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['match-day'] });
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
    onError: (err: Error & { code?: string; status?: number }) => {
      const msg = err.message ?? '';
      // Differentiate the three failure modes:
      //   1. joker_cap_exceeded — DB trigger blocks the 4th joker. Revert the
      //      toggle only; keep the score the user typed.
      //   2. RLS lock — kickoff passed. Roll back ALL optimistic state.
      //   3. Anything else (500, network, etc.) — keep state, show generic error.
      const isJokerCap = msg.includes('joker_cap_exceeded') || /joker.*3/i.test(msg);
      const isRlsLock = !isJokerCap && (msg.includes('row-level security') || msg.includes('new row violates'));

      if (isJokerCap) {
        // Roll back ONLY the joker flip — the rest of the prediction is fine.
        setJokerUsed(prediction?.joker_used ?? false);
        setSaveStatus('jokerCap');
      } else if (isRlsLock) {
        // Full roll-back of optimistic state
        if (prediction) {
          setHomeScore(prediction.home);
          setAwayScore(prediction.away);
          setJokerUsed(prediction.joker_used);
          setAdvancer(prediction.advancer_team_id ?? null);
        } else {
          setHomeScore(null);
          setAwayScore(null);
          setJokerUsed(false);
          setAdvancer(null);
        }
        setSaveStatus('locked');
      } else {
        setSaveStatus('error');
      }

      // Make sure the joker budget query refetches even on error, so the UI
      // doesn't get out of sync with the DB.
      invalidateJoker();
      setTimeout(() => setSaveStatus('idle'), 3500);
    },
  });

  /* ---- save flow: debounced auto-save + immediate flush ---- */

  /** Returns true if the prediction is in a state that can be persisted. */
  const isPredictionReady = (h: number | null, a: number | null, adv: string | null) => {
    if (h == null || a == null || h < 0 || a < 0 || isLocked) return false;
    if (isKnockout && h === a && adv == null) return false; // KO draw needs advancer
    return true;
  };

  const scheduleAutoSave = useCallback(
    (h: number | null, a: number | null, joker: boolean, adv: string | null) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (!isPredictionReady(h, a, adv)) return;
      // isPredictionReady has already verified h and a are non-null numbers.
      setSaveStatus('saving');
      saveTimer.current = setTimeout(() => {
        submit.mutate({ home: h as number, away: a as number, joker, adv });
      }, AUTOSAVE_DELAY);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLocked, isKnockout, submit],
  );

  /** Cancel any pending debounce and fire the upsert immediately. Used by
   *  the Save button and by joker-toggle (which shouldn't wait 800ms). */
  const flushSave = useCallback(
    (h: number | null, a: number | null, joker: boolean, adv: string | null) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (!isPredictionReady(h, a, adv)) return;
      setSaveStatus('saving');
      submit.mutate({ home: h as number, away: a as number, joker, adv });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLocked, isKnockout, submit],
  );

  /* ---- stepper handlers ---- */

  const incHome = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = Math.min(9, (homeScore ?? -1) + 1);
    setHomeScore(next);
    scheduleAutoSave(next, awayScore, jokerUsed, advancer);
  };
  const decHome = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (homeScore == null || homeScore <= 0) return;
    const next = homeScore - 1;
    setHomeScore(next);
    scheduleAutoSave(next, awayScore, jokerUsed, advancer);
  };
  const incAway = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = Math.min(9, (awayScore ?? -1) + 1);
    setAwayScore(next);
    scheduleAutoSave(homeScore, next, jokerUsed, advancer);
  };
  const decAway = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (awayScore == null || awayScore <= 0) return;
    const next = awayScore - 1;
    setAwayScore(next);
    scheduleAutoSave(homeScore, next, jokerUsed, advancer);
  };

  const toggleJoker = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (jokerDisabled && !jokerUsed) return; // guard against keyboard-bypass
    const next = !jokerUsed;
    setJokerUsed(next);
    // Fire IMMEDIATELY (no 800ms debounce). Joker is a discrete commitment
    // that must hit the DB right away so the budget refreshes and other
    // open cards re-render their disabled state in real-time.
    flushSave(homeScore, awayScore, next, advancer);
  };

  /* ---- direct numeric input handlers ---- */
  // User can tap the score number and type any value 0-30, instead of using +/−.
  const setHomeDirect = (raw: string) => {
    if (raw === '') { setHomeScore(null); return; }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 30) return;
    setHomeScore(n);
    scheduleAutoSave(n, awayScore, jokerUsed, advancer);
  };
  const setAwayDirect = (raw: string) => {
    if (raw === '') { setAwayScore(null); return; }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 30) return;
    setAwayScore(n);
    scheduleAutoSave(homeScore, n, jokerUsed, advancer);
  };

  const pickAdvancer = (team: string) => {
    setAdvancer(team);
    scheduleAutoSave(homeScore, awayScore, jokerUsed, team);
  };

  /* ---- 1/X/2 quick-pick handlers ---- */
  // Tapping a quick-pick fills a default exact score and saves immediately.
  // User can then expand to fine-tune via the score steppers.
  const quickPick = (e: React.MouseEvent, outcome: '1' | 'X' | '2') => {
    e.stopPropagation();
    if (isLocked) return;
    let h: number;
    let a: number;
    if (outcome === '1') { h = 1; a = 0; }
    else if (outcome === '2') { h = 0; a = 1; }
    else { h = 1; a = 1; }
    setHomeScore(h);
    setAwayScore(a);
    // Knockouts require an advancer when draw — we don't auto-pick that.
    // The save will be deferred until user picks one (scheduleAutoSave guards this).
    scheduleAutoSave(h, a, jokerUsed, advancer);
  };

  // Detect currently-implied outcome from the prediction (for visual selected state).
  const currentOutcome: '1' | 'X' | '2' | null =
    homeScore != null && awayScore != null
      ? homeScore > awayScore ? '1'
      : homeScore < awayScore ? '2'
      : 'X'
      : null;

  /* ---- can expand? ---- */
  // TBD cards expand to show a locked notice; otherwise need either an open
  // prediction window or an existing prediction to review.
  const canExpand = isTbd || !isLocked || !!prediction;

  /* ---- render ---- */
  return (
    <div
      ref={cardRef}
      className={`rounded-xl border transition-all overflow-hidden ${
        expanded
          ? 'border-primary/50 bg-card shadow-lg shadow-primary/5'
          : 'border-border/50 bg-muted/40'
      }`}
    >
      {/* ====== COLLAPSED HEADER ====== */}
      <div
        onClick={() => canExpand && onToggle()}
        className={`p-3 card-pressable ${canExpand ? 'cursor-pointer' : 'cursor-default'}`}
        role={canExpand ? 'button' : undefined}
        tabIndex={canExpand ? 0 : undefined}
        aria-expanded={expanded}
        aria-label={`${homeLabel} vs ${awayLabel}`}
        onKeyDown={(e) => { if (canExpand && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onToggle(); } }}
      >
        {/* Date + time + match-number + countdown */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {match.match_number != null && (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/40 border border-emerald-700/40 px-1.5 py-0.5 rounded-full tabular-nums" aria-label={`Match ${match.match_number}`}>
                {lang === 'he' ? `מש׳ ${match.match_number}` : `M${match.match_number}`}
              </span>
            )}
            <time className="text-[11px] text-muted-foreground" dateTime={match.kickoff_at}>
              {dateStr} · {timeStr}
            </time>
          </div>
          {isTbd ? (
            <span className="text-[10px] text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full">
              {lang === 'he' ? 'טרם נקבע' : 'TBD'}
            </span>
          ) : !isLocked && countdown ? (
            <span
              dir={lang === 'he' ? 'rtl' : 'ltr'}
              className="text-[10px] text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full"
            >
              {countdown}
            </span>
          ) : isLocked && !isFinished ? (
            <span className="text-[10px] text-yellow-400 font-medium bg-yellow-400/10 px-2 py-0.5 rounded-full">
              🔒 {t('match.status.locked')}
            </span>
          ) : isFinished ? (
            <span className="text-[10px] text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full">
              {match.status}
            </span>
          ) : null}
        </div>

        {/* Teams row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TeamFlag team={isTbdHome ? null : match.home_team} size="md" />
            <span className={`team-name ${isTbdHome ? 'text-muted-foreground italic' : ''}`}>
              {homeLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 mx-1 tabular-nums" data-score>
            {isFinished && match.home_score_120 != null ? (
              <>
                <span className="text-lg font-black">{match.home_score_120}</span>
                <span className="text-xs text-muted-foreground">:</span>
                <span className="text-lg font-black">{match.away_score_120}</span>
              </>
            ) : prediction && !isTbd ? (
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

          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span className={`team-name text-end ${isTbdAway ? 'text-muted-foreground italic' : ''}`}>
              {awayLabel}
            </span>
            <TeamFlag team={isTbdAway ? null : match.away_team} size="md" />
          </div>
        </div>

        {/* Points badge (scored) */}
        {isFinished && prediction?.points != null && (
          <div className="text-center mt-1.5">
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full tabular-nums">
              +{prediction.points} {t('leaderboard.points')}
            </span>
          </div>
        )}

        {/* 1/X/2 quick-pick buttons — always visible on open, predictable matches */}
        {!isFinished && !expanded && (
          <div className="flex gap-1.5 mt-2.5" role="group" aria-label={lang === 'he' ? 'ניחוש מהיר' : 'Quick pick'}>
            {(['1', 'X', '2'] as const).map((o) => {
              const selected = currentOutcome === o && prediction != null;
              const disabled = isLocked; // TBD and post-kickoff both block
              return (
                <button
                  key={o}
                  type="button"
                  onClick={(e) => quickPick(e, o)}
                  disabled={disabled}
                  aria-pressed={selected}
                  aria-label={
                    o === '1' ? (lang === 'he' ? 'ניצחון בית' : 'Home win')
                    : o === 'X' ? (lang === 'he' ? 'תיקו' : 'Draw')
                    : (lang === 'he' ? 'ניצחון חוץ' : 'Away win')
                  }
                  className={`
                    flex-1 h-11 rounded-lg font-black text-base tabular-nums transition-all
                    ${disabled
                      ? 'bg-muted/30 text-muted-foreground/40 cursor-not-allowed border border-border/40'
                      : selected
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 border border-primary'
                        : 'bg-muted/60 text-foreground hover:bg-muted active:scale-95 border border-border/60'}
                  `}
                >
                  {disabled && isTbd ? '🔒' : o}
                </button>
              );
            })}
          </div>
        )}

        {/* TBD note (replaces tap-to-predict hint when matchup not yet set) */}
        {isTbd && !expanded && (
          <p className="text-center text-[10px] text-muted-foreground/70 mt-1.5">
            {lang === 'he' ? 'יקבע לאחר שלב הבתים' : 'Set after group stage'}
          </p>
        )}
      </div>

      {/* ====== EXPANDED CONTENT ====== */}
      {expanded && (
        <div className="px-3 pb-4 border-t border-border/50 pt-4 space-y-4">
          {isTbd ? (
            /* ---------- TBD: matchup not yet determined ---------- */
            <div className="text-center space-y-2 py-2">
              <span className="text-3xl block" aria-hidden="true">🔒</span>
              <p className="text-sm font-bold">
                {lang === 'he' ? 'המשחק טרם נקבע' : 'Matchup not yet determined'}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                {lang === 'he'
                  ? 'הקבוצות יתעדכנו אוטומטית בסיום שלב הבתים. לא ניתן לנחש עדיין.'
                  : 'Teams will be filled in automatically once the group stage ends. Predictions are not available yet.'}
              </p>
              <div className="text-[11px] text-muted-foreground/80 pt-2 space-y-0.5">
                <p>{lang === 'he' ? 'מארחת:' : 'Home:'} <span className="font-medium">{homeLabel}</span></p>
                <p>{lang === 'he' ? 'אורחת:' : 'Away:'} <span className="font-medium">{awayLabel}</span></p>
              </div>
            </div>
          ) : !isLocked ? (
            /* ---------- PREDICTION FORM ---------- */
            <>
              {/* Team display — SVG flag + name, no 3-letter codes */}
              <div className="flex items-center justify-between px-2 gap-2">
                <div className="flex flex-col items-center text-center flex-1 min-w-0 gap-1">
                  <TeamFlag team={match.home_team} size="lg" />
                  <span className="text-sm font-bold truncate w-full px-1">{getTeamName(match.home_team, lang)}</span>
                </div>
                <span className="text-xs font-bold text-muted-foreground/50">vs</span>
                <div className="flex flex-col items-center text-center flex-1 min-w-0 gap-1">
                  <TeamFlag team={match.away_team} size="lg" />
                  <span className="text-sm font-bold truncate w-full px-1">{getTeamName(match.away_team, lang)}</span>
                </div>
              </div>

              {/* Score steppers: − [ input ] + : − [ input ] +
                  The number is also a native numeric input — tap to type any value 0-30. */}
              <div className="flex items-center justify-center gap-3">
                {/* Home stepper */}
                <div className="score-stepper" role="group" aria-label={`${getTeamName(match.home_team, lang)} score`}>
                  <button
                    type="button"
                    className="score-stepper-btn"
                    onClick={decHome}
                    disabled={homeScore == null || homeScore <= 0}
                    aria-label="Decrease"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min={0}
                    max={30}
                    value={homeScore ?? ''}
                    onChange={(e) => setHomeDirect(e.target.value)}
                    onClick={(e) => { e.stopPropagation(); (e.target as HTMLInputElement).select(); }}
                    aria-label={`${getTeamName(match.home_team, lang)} score`}
                    className={`score-stepper-value score-stepper-input ${homeScore != null ? 'has-value' : ''}`}
                  />
                  <button
                    type="button"
                    className="score-stepper-btn"
                    onClick={incHome}
                    disabled={homeScore != null && homeScore >= 30}
                    aria-label="Increase"
                  >
                    +
                  </button>
                </div>

                <span className="text-xl font-bold text-muted-foreground">:</span>

                {/* Away stepper */}
                <div className="score-stepper" role="group" aria-label={`${getTeamName(match.away_team, lang)} score`}>
                  <button
                    type="button"
                    className="score-stepper-btn"
                    onClick={decAway}
                    disabled={awayScore == null || awayScore <= 0}
                    aria-label="Decrease"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min={0}
                    max={30}
                    value={awayScore ?? ''}
                    onChange={(e) => setAwayDirect(e.target.value)}
                    onClick={(e) => { e.stopPropagation(); (e.target as HTMLInputElement).select(); }}
                    aria-label={`${getTeamName(match.away_team, lang)} score`}
                    className={`score-stepper-value score-stepper-input ${awayScore != null ? 'has-value' : ''}`}
                  />
                  <button
                    type="button"
                    className="score-stepper-btn"
                    onClick={incAway}
                    disabled={awayScore != null && awayScore >= 30}
                    aria-label="Increase"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Auto-save status indicator */}
              <div className="text-center h-5">
                {saveStatus === 'saving' && (
                  <span className="save-indicator saving">
                    {lang === 'he' ? 'שומר...' : 'Saving...'}
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="save-indicator saved">
                    ✓ {t('match.saved')}
                  </span>
                )}
                {saveStatus === 'locked' && (
                  <span className="save-indicator error">
                    🔒 {t('match.locked')}
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="save-indicator error">
                    ⚠ {t('common.saveFailed')}
                  </span>
                )}
                {saveStatus === 'jokerCap' && (
                  <span className="save-indicator error">
                    🚫 {lang === 'he' ? 'הגעת למקסימום 3 ג׳וקרים' : 'Joker cap reached (3 max)'}
                  </span>
                )}
              </div>

              {/* Joker toggle */}
              <div
                className="flex items-center justify-between p-3 rounded-xl bg-muted/60 border border-border/50"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="min-w-0 pe-2">
                  <p className="text-sm font-medium">{t('joker.label')}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {scoresIncomplete
                      ? (lang === 'he' ? 'הזן ניחוש כדי להפעיל ג׳וקר' : 'Set a score first to enable Joker')
                      : atCap && !jokerOnThis
                        ? t('joker.capReached')
                        : jokerBudget
                          ? t('joker.remaining', { count: jokerBudget.remaining })
                          : ''}
                  </p>
                </div>
                <button
                  dir="ltr"
                  type="button"
                  role="switch"
                  aria-checked={jokerUsed}
                  aria-label={t('joker.label')}
                  onClick={toggleJoker}
                  disabled={jokerDisabled && !jokerUsed}
                  className={`
                    relative inline-flex h-8 w-14 shrink-0 rounded-full transition-colors
                    ${jokerUsed ? 'bg-primary' : 'bg-muted-foreground/30'}
                    ${jokerDisabled && !jokerUsed ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                  title={t('joker.tooltip')}
                >
                  <span
                    className={`
                      pointer-events-none block h-6 w-6 rounded-full bg-white shadow mt-1 transition-transform
                      ${jokerUsed ? 'translate-x-[1.5rem]' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>

              {jokerUsed && (
                <p className="text-sm text-primary font-semibold text-center" role="status">
                  🃏 {t('joker.active')}
                </p>
              )}

              {/* Advancer picker (knockout draw) */}
              {needsAdvancer && (
                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs font-medium text-center">{t('match.advancer')}</p>
                  <p className="text-[10px] text-muted-foreground text-center">{t('match.advancerHint')}</p>
                  <div className="flex gap-2" role="radiogroup" aria-label={t('match.advancer')}>
                    {([match.home_team, match.away_team].filter(Boolean) as string[]).map((team) => (
                      <button
                        key={team}
                        type="button"
                        role="radio"
                        aria-checked={advancer === team}
                        aria-label={getTeamName(team, lang)}
                        onClick={() => pickAdvancer(team)}
                        className={`flex-1 p-2.5 rounded-xl border text-center transition-all ${
                          advancer === team
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-border'
                        }`}
                      >
                        <div className="flex justify-center mb-1"><TeamFlag team={team} size="md" /></div>
                        <span className="text-[10px] font-medium">{getTeamName(team, lang)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Explicit Save button. Auto-save still runs in the background
                  on every change, but tapping this flushes any pending
                  debounce and confirms immediately. */}
              <Button
                onClick={(e) => { e.stopPropagation(); flushSave(homeScore, awayScore, jokerUsed, advancer); }}
                disabled={
                  submit.isPending
                  || !isPredictionReady(homeScore, awayScore, advancer)
                }
                className="w-full rounded-xl h-11 text-base font-bold"
              >
                {submit.isPending
                  ? (lang === 'he' ? 'שומר...' : 'Saving...')
                  : saveStatus === 'saved'
                    ? `✓ ${t('match.saved')}`
                    : prediction
                      ? t('match.update')
                      : t('match.submit')}
              </Button>
            </>
          ) : prediction ? (
            /* ---------- LOCKED / SCORED: prediction summary ---------- */
            <div className="space-y-3">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  {t('match.prediction')}
                </p>
                <div className="flex items-center justify-center gap-3 tabular-nums" data-score>
                  <TeamFlag team={match.home_team} size="sm" />
                  <span className="text-2xl font-bold text-primary">{prediction.home}</span>
                  <span className="text-muted-foreground">:</span>
                  <span className="text-2xl font-bold text-primary">{prediction.away}</span>
                  <TeamFlag team={match.away_team} size="sm" />
                </div>
                {prediction.joker_used && (
                  <p className="text-xs mt-1">🃏 {t('joker.active')}</p>
                )}
                {prediction.advancer_team_id && (
                  <p className="text-[10px] text-muted-foreground mt-1 inline-flex items-center gap-1.5 justify-center">
                    {t('match.advancer')}: <TeamFlag team={prediction.advancer_team_id} size="sm" /> {getTeamName(prediction.advancer_team_id, lang)}
                  </p>
                )}
              </div>

              {/* Points breakdown */}
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
                      <span className={`text-sm font-bold tabular-nums ${baseColor}`}>+{basePoints}</span>
                    </div>
                    {prediction.joker_used && (
                      <div className="flex items-center justify-between bg-amber-900/20 rounded-lg px-3 py-1.5 border border-amber-700/20">
                        <span className="text-xs text-amber-400">🃏 {t('pointsBreakdown.jokerApplied')}</span>
                        <span className="text-sm font-bold text-amber-400 tabular-nums">= {jokerMultiplied}</span>
                      </div>
                    )}
                    {hasAdvancerBonus && (
                      <div className="flex items-center justify-between bg-emerald-900/20 rounded-lg px-3 py-1.5 border border-emerald-700/20">
                        <span className="text-xs text-emerald-400">{t('pointsBreakdown.advancerCorrect')}</span>
                        <span className="text-sm font-bold text-emerald-400 tabular-nums">+2</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between bg-primary/10 rounded-lg px-3 py-2 border border-primary/20">
                      <span className="text-sm font-bold">{t('pointsBreakdown.total')}</span>
                      <span className="text-xl font-black text-primary tabular-nums">+{total}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-2">
              {t('match.locked')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
