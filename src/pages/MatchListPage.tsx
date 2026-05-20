import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRealtimeMatches } from '@/hooks/useRealtimeMatches';
import { supabase } from '@/lib/supabase';
import { getFlag, getTeamName } from '@/lib/team-utils';

/* ---------- constants ---------- */

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

const GROUP_STAGES = [
  'GROUP_A', 'GROUP_B', 'GROUP_C', 'GROUP_D',
  'GROUP_E', 'GROUP_F', 'GROUP_G', 'GROUP_H',
  'GROUP_I', 'GROUP_J', 'GROUP_K', 'GROUP_L',
];

const KNOCKOUT_STAGES = ['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'];

const STAGE_ORDER: Record<string, number> = {};
[...GROUP_STAGES, ...KNOCKOUT_STAGES].forEach((s, i) => {
  STAGE_ORDER[s] = i;
});

type Phase = 'group' | 'knockout';
type MatchDisplayStatus = 'open' | 'predicted' | 'locked' | 'scored';

/* ---------- helpers ---------- */

function getStatus(
  kickoff: string,
  matchStatus: string,
  predPoints: number | null | undefined,
  hasPred: boolean,
): MatchDisplayStatus {
  if (predPoints != null || FINISHED_STATUSES.has(matchStatus)) return 'scored';
  if (new Date() >= new Date(kickoff)) return 'locked';
  if (hasPred) return 'predicted';
  return 'open';
}

function fmtDate(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function fmtTime(iso: string, lang: string) {
  return new Date(iso).toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isGroupStage(stage: string) {
  return stage.startsWith('GROUP_');
}

function getGroupLetter(stage: string): string {
  return stage.replace('GROUP_', '');
}

/** Returns a human-readable countdown like "3d 5h" or "2h 30m" */
function getCountdown(kickoffIso: string, lang: string): string | null {
  const diff = new Date(kickoffIso).getTime() - Date.now();
  if (diff <= 0) return null;

  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const m = Math.floor((diff / (1000 * 60)) % 60);

  const dLabel = lang === 'he' ? 'י׳' : 'd';
  const hLabel = lang === 'he' ? 'ש׳' : 'h';
  const mLabel = lang === 'he' ? 'ד׳' : 'm';

  if (d > 0) return `${d}${dLabel} ${h}${hLabel}`;
  if (h > 0) return `${h}${hLabel} ${m}${mLabel}`;
  return `${m}${mLabel}`;
}

/* ---------- component ---------- */

export default function MatchListPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user, loading: authLoading } = useRequireAuth();
  const [phase, setPhase] = useState<Phase>('group');
  const [openStages, setOpenStages] = useState<Set<string>>(new Set());

  useRealtimeMatches();

  const { data: matches, isLoading: matchesLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('kickoff_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: predictions } = useQuery({
    queryKey: ['my-predictions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('predictions')
        .select('match_id, home, away, joker_used, points')
        .eq('user_id', user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Auto-open first stage with open matches
  const stageGroups = useMemo(() => {
    if (!matches) return [];

    const predMap = new Map(
      (predictions ?? []).map((p) => [p.match_id, p]),
    );

    const filtered = matches.filter((m) =>
      phase === 'group' ? isGroupStage(m.stage) : !isGroupStage(m.stage),
    );

    const stageMap = new Map<
      string,
      {
        matches: (typeof matches[number] & { _pred?: typeof predictions extends (infer U)[] | null ? U : never })[];
        predicted: number;
        total: number;
      }
    >();

    for (const m of filtered) {
      const entry = stageMap.get(m.stage) ?? { matches: [], predicted: 0, total: 0 };
      const pred = predMap.get(m.id);
      entry.matches.push({ ...m, _pred: pred ?? undefined });
      entry.total++;
      if (pred) entry.predicted++;
      stageMap.set(m.stage, entry);
    }

    const sorted = Array.from(stageMap.entries()).sort(
      ([a], [b]) => (STAGE_ORDER[a] ?? 99) - (STAGE_ORDER[b] ?? 99),
    );

    // Auto-open first group that has open matches
    if (openStages.size === 0 && sorted.length > 0) {
      const firstOpen = sorted.find(([, data]) =>
        data.matches.some((m) => getStatus(m.kickoff_at, m.status, m._pred?.points, !!m._pred) === 'open')
      );
      if (firstOpen) {
        setTimeout(() => setOpenStages(new Set([firstOpen[0]])), 0);
      } else {
        setTimeout(() => setOpenStages(new Set([sorted[0][0]])), 0);
      }
    }

    return sorted;
  }, [matches, predictions, phase]);

  const toggleStage = (stage: string) => {
    setOpenStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  };

  if (authLoading || matchesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <span className="text-3xl">⚽</span>
          <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-lg mx-auto px-4 pb-4 space-y-4">
        {/* Header */}
        <div className="text-center pt-6 pb-2">
          <h1 className="text-xl font-bold">{t('match.allMatches')}</h1>
        </div>

        {/* Phase tabs */}
        <div className="flex gap-2 bg-muted/50 p-1 rounded-xl">
          <button
            onClick={() => { setPhase('group'); setOpenStages(new Set()); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              phase === 'group'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('stages.groupPhase')}
          </button>
          <button
            onClick={() => { setPhase('knockout'); setOpenStages(new Set()); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              phase === 'knockout'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('stages.knockoutPhase')}
          </button>
        </div>

        {/* Stage accordions */}
        {stageGroups.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{t('common.noData')}</p>
        ) : (
          <div className="space-y-3">
            {stageGroups.map(([stage, data]) => {
              const isOpen = openStages.has(stage);
              const isGroup = isGroupStage(stage);
              const letter = isGroup ? getGroupLetter(stage) : '';
              const progress = `${data.predicted} / ${data.total}`;
              const allDone = data.predicted === data.total;

              return (
                <div key={stage} className="group-accordion">
                  {/* Accordion header */}
                  <button
                    onClick={() => toggleStage(stage)}
                    className="group-accordion-header w-full"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-lg transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}>
                        ▾
                      </span>
                      <div className="text-start">
                        <p className="font-bold text-sm">
                          {t(`stages.${stage}`, { defaultValue: stage.replace('_', ' ') })}
                        </p>
                        <p className={`text-xs ${allDone ? 'text-primary' : 'text-muted-foreground'}`}>
                          {progress} {lang === 'he' ? 'ניחושים' : 'predicted'}
                        </p>
                      </div>
                    </div>

                    {isGroup ? (
                      <span className="group-accordion-badge bg-emerald-900/60 text-emerald-400 border border-emerald-700/50">
                        {letter}
                      </span>
                    ) : (
                      <span className="group-accordion-badge bg-amber-900/60 text-amber-400 border border-amber-700/50">
                        {stage === 'FINAL' ? '🏆' : stage === '3RD' ? '🥉' : '⚡'}
                      </span>
                    )}
                  </button>

                  {/* Accordion content */}
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-2">
                      {data.matches.map((m) => {
                        const status = getStatus(m.kickoff_at, m.status, m._pred?.points, !!m._pred);
                        return (
                          <Link key={m.id} to={`/match/${m.id}`} className="block">
                            <div className="bg-muted/40 rounded-xl p-3 hover:bg-muted/70 transition-colors border border-border/50">
                              {/* Date + time */}
                              <div className="text-center mb-2">
                                <span className="text-xs text-muted-foreground">
                                  {fmtDate(m.kickoff_at, lang)} · {fmtTime(m.kickoff_at, lang)}
                                </span>
                              </div>

                              {/* Teams row with flags */}
                              <div className="flex items-center justify-between gap-2">
                                {/* Home team */}
                                <div className="flex-1 text-center">
                                  <span className="text-2xl block mb-1">{getFlag(m.home_team)}</span>
                                  <span className="text-xs font-medium block truncate">
                                    {getTeamName(m.home_team, lang)}
                                  </span>
                                </div>

                                {/* Score / VS / Prediction */}
                                <div className="flex flex-col items-center gap-1">
                                  {status === 'scored' && m.home_score_120 != null ? (
                                    <>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xl font-bold">{m.home_score_120}</span>
                                        <span className="text-xs text-muted-foreground">:</span>
                                        <span className="text-xl font-bold">{m.away_score_120}</span>
                                      </div>
                                      {m.status !== 'FT' && (
                                        <span className="text-[10px] text-amber-400 font-medium">{m.status}</span>
                                      )}
                                      {m._pred?.points != null && (
                                        <span className="text-xs font-bold text-primary">+{m._pred.points}</span>
                                      )}
                                    </>
                                  ) : m._pred ? (
                                    <>
                                      <div className="flex items-center gap-2">
                                        <span className="text-lg font-bold text-primary">{m._pred.home}</span>
                                        <span className="text-xs text-muted-foreground">:</span>
                                        <span className="text-lg font-bold text-primary">{m._pred.away}</span>
                                      </div>
                                      {m._pred.joker_used && (
                                        <span className="text-xs">🃏</span>
                                      )}
                                    </>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/30" />
                                      <span className="text-xs text-muted-foreground">:</span>
                                      <span className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/30" />
                                    </div>
                                  )}
                                </div>

                                {/* Away team */}
                                <div className="flex-1 text-center">
                                  <span className="text-2xl block mb-1">{getFlag(m.away_team)}</span>
                                  <span className="text-xs font-medium block truncate">
                                    {getTeamName(m.away_team, lang)}
                                  </span>
                                </div>
                              </div>

                              {/* Status indicator with countdown */}
                              {status === 'open' && (() => {
                                const cd = getCountdown(m.kickoff_at, lang);
                                return (
                                  <div className="flex items-center justify-center gap-2 mt-2">
                                    <span className="text-[10px] text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
                                      {t('match.status.open')}
                                    </span>
                                    {cd && (
                                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                        🔒 {cd}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                              {status === 'predicted' && (() => {
                                const cd = getCountdown(m.kickoff_at, lang);
                                return cd ? (
                                  <div className="text-center mt-2">
                                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                      🔒 {cd}
                                    </span>
                                  </div>
                                ) : null;
                              })()}
                              {status === 'locked' && !m._pred && (
                                <div className="text-center mt-2">
                                  <span className="text-[10px] text-yellow-400 font-medium bg-yellow-400/10 px-2 py-0.5 rounded-full">
                                    {t('match.status.locked')}
                                  </span>
                                </div>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
