import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRealtimeMatches } from '@/hooks/useRealtimeMatches';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/* ---------- constants ---------- */

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

const GROUP_STAGES = [
  'GROUP_A', 'GROUP_B', 'GROUP_C', 'GROUP_D',
  'GROUP_E', 'GROUP_F', 'GROUP_G', 'GROUP_H',
  'GROUP_I', 'GROUP_J', 'GROUP_K', 'GROUP_L',
];

const KNOCKOUT_STAGES = ['R32', 'R16', 'QF', 'SF', '3RD', 'FINAL'];

/** Canonical order for stages. Lower index = earlier stage. */
const STAGE_ORDER: Record<string, number> = {};
[...GROUP_STAGES, ...KNOCKOUT_STAGES].forEach((s, i) => {
  STAGE_ORDER[s] = i;
});

type Phase = 'group' | 'knockout';

/* ---------- helpers ---------- */

type MatchDisplayStatus = 'open' | 'predicted' | 'locked' | 'scored';

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

const STATUS_STYLE: Record<MatchDisplayStatus, string> = {
  open: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  predicted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  locked: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  scored: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

function fmtDate(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
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

/* ---------- component ---------- */

export default function MatchListPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user, loading: authLoading } = useRequireAuth();
  const [phase, setPhase] = useState<Phase>('group');

  // Real-time match updates → auto-refresh list
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

  // Build prediction lookup and group matches by stage within the selected phase.
  const stageGroups = useMemo(() => {
    if (!matches) return [];

    const predMap = new Map(
      (predictions ?? []).map((p) => [p.match_id, p]),
    );

    // Filter matches by phase
    const filtered = matches.filter((m) =>
      phase === 'group' ? isGroupStage(m.stage) : !isGroupStage(m.stage),
    );

    // Group by stage
    const stageMap = new Map<
      string,
      (typeof matches[number] & {
        _pred?: (typeof predictions extends (infer U)[] | null ? U : never);
      })[]
    >();

    for (const m of filtered) {
      const arr = stageMap.get(m.stage) ?? [];
      arr.push({ ...m, _pred: predMap.get(m.id) ?? undefined });
      stageMap.set(m.stage, arr);
    }

    // Sort stages by canonical order
    return Array.from(stageMap.entries()).sort(
      ([a], [b]) => (STAGE_ORDER[a] ?? 99) - (STAGE_ORDER[b] ?? 99),
    );
  }, [matches, predictions, phase]);

  // Stats for phase tabs
  const stats = useMemo(() => {
    if (!matches) return { group: 0, knockout: 0 };
    const predMap = new Map(
      (predictions ?? []).map((p) => [p.match_id, p]),
    );
    let groupOpen = 0;
    let koOpen = 0;
    for (const m of matches) {
      const s = getStatus(m.kickoff_at, m.status, predMap.get(m.id)?.points, !!predMap.get(m.id));
      if (s === 'open') {
        if (isGroupStage(m.stage)) groupOpen++;
        else koOpen++;
      }
    }
    return { group: groupOpen, knockout: koOpen };
  }, [matches, predictions]);

  if (authLoading || matchesLoading) {
    return <p className="p-6 text-center">{t('common.loading')}</p>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      <div className="max-w-lg mx-auto px-4 pb-10 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pt-4">
          <h1 className="text-2xl font-extrabold tracking-tight">{t('match.allMatches')}</h1>
          <Link to="/">
            <Button variant="ghost" size="sm">{t('common.back')}</Button>
          </Link>
        </div>

        {/* Phase tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setPhase('group')}
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
              phase === 'group'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {t('stages.groupPhase')}
            {stats.group > 0 && (
              <span className={`ms-1.5 inline-flex items-center justify-center w-5 h-5 text-xs rounded-full ${
                phase === 'group' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary'
              }`}>
                {stats.group}
              </span>
            )}
          </button>
          <button
            onClick={() => setPhase('knockout')}
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
              phase === 'knockout'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {t('stages.knockoutPhase')}
            {stats.knockout > 0 && (
              <span className={`ms-1.5 inline-flex items-center justify-center w-5 h-5 text-xs rounded-full ${
                phase === 'knockout' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary'
              }`}>
                {stats.knockout}
              </span>
            )}
          </button>
        </div>

        {/* Matches by stage */}
        {(!matches || matches.length === 0) ? (
          <p className="text-center text-muted-foreground py-8">{t('common.noData')}</p>
        ) : stageGroups.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{t('common.noData')}</p>
        ) : (
          stageGroups.map(([stage, items]) => (
            <div key={stage} className="space-y-2">
              {/* Stage header */}
              <div className={`stage-header ${isGroupStage(stage) ? 'stage-group' : 'stage-knockout'}`}>
                {t(`stages.${stage}`, { defaultValue: stage.replace('_', ' ') })}
              </div>

              {items.map((m) => {
                const status = getStatus(m.kickoff_at, m.status, m._pred?.points, !!m._pred);
                return (
                  <Link key={m.id} to={`/match/${m.id}`} className="block">
                    <Card className="hover:border-primary/30 hover:shadow-sm transition-all">
                      <CardContent className="p-3">
                        {/* Top row: date · time · status badge */}
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-muted-foreground">
                            {fmtDate(m.kickoff_at, lang)} · {fmtTime(m.kickoff_at, lang)}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[status]}`}
                          >
                            {t(
                              status === 'predicted'
                                ? 'match.predicted'
                                : `match.status.${status}`,
                            )}
                          </span>
                        </div>

                        {/* Teams row */}
                        <div className="flex items-center justify-between">
                          <div className="flex-1 text-sm">
                            <span className="font-semibold">{m.home_team}</span>
                            <span className="text-muted-foreground mx-2 text-xs">{t('match.vs')}</span>
                            <span className="font-semibold">{m.away_team}</span>
                          </div>

                          {/* User's prediction */}
                          {m._pred && (
                            <span className="text-sm font-mono font-bold ms-2 bg-muted px-2 py-0.5 rounded">
                              {m._pred.home}–{m._pred.away}
                              {m._pred.joker_used && ' 🃏'}
                            </span>
                          )}
                        </div>

                        {/* Actual result + points */}
                        {status === 'scored' && m.home_score_120 != null && (
                          <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t text-xs">
                            <span className="font-mono text-muted-foreground">
                              {t('match.result')}: {m.home_score_120}–{m.away_score_120}
                              {m.status !== 'FT' && ` (${m.status})`}
                            </span>
                            {m._pred?.points != null && (
                              <span className="font-bold text-primary">
                                +{m._pred.points} {t('leaderboard.points')}
                              </span>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
