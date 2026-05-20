import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/* ---------- helpers ---------- */

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

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
  open: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
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

/* ---------- component ---------- */

export default function MatchListPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user, loading: authLoading } = useRequireAuth();

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

  // Build prediction lookup and group matches by calendar date.
  const grouped = useMemo(() => {
    if (!matches) return [];

    const predMap = new Map(
      (predictions ?? []).map((p) => [p.match_id, p]),
    );

    const result: { date: string; items: (typeof matches[number] & { _pred?: typeof predictions extends (infer U)[] | null ? U : never })[] }[] = [];
    let curDate = '';
    let curItems: typeof result[number]['items'] = [];

    for (const m of matches) {
      const d = fmtDate(m.kickoff_at, lang);
      if (d !== curDate) {
        if (curItems.length) result.push({ date: curDate, items: curItems });
        curDate = d;
        curItems = [];
      }
      curItems.push({ ...m, _pred: predMap.get(m.id) ?? undefined });
    }
    if (curItems.length) result.push({ date: curDate, items: curItems });
    return result;
  }, [matches, predictions, lang]);

  if (authLoading || matchesLoading) {
    return <p className="p-6 text-center">{t('common.loading')}</p>;
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between pt-4">
        <h1 className="text-2xl font-bold">{t('match.allMatches')}</h1>
        <Link to="/">
          <Button variant="ghost" size="sm">{t('common.back')}</Button>
        </Link>
      </div>

      {(!matches || matches.length === 0) ? (
        <p className="text-center text-muted-foreground py-8">{t('common.noData')}</p>
      ) : (
        grouped.map((g) => (
          <div key={g.date}>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2 sticky top-0 bg-background py-1 z-10">
              {g.date}
            </h2>
            <div className="space-y-2">
              {g.items.map((m) => {
                const status = getStatus(m.kickoff_at, m.status, m._pred?.points, !!m._pred);
                return (
                  <Link key={m.id} to={`/match/${m.id}`} className="block">
                    <Card className="hover:bg-accent/50 transition-colors">
                      <CardContent className="p-3">
                        {/* Top row: time · stage · status badge */}
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">
                            {fmtTime(m.kickoff_at, lang)} · {m.stage.replace('_', ' ')}
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
                            <span className="font-medium">{m.home_team}</span>
                            <span className="text-muted-foreground mx-2">{t('match.vs')}</span>
                            <span className="font-medium">{m.away_team}</span>
                          </div>

                          {/* User's prediction */}
                          {m._pred && (
                            <span className="text-sm font-mono font-bold ms-2">
                              {m._pred.home}–{m._pred.away}
                              {m._pred.joker_used && ' 🃏'}
                            </span>
                          )}
                        </div>

                        {/* Actual result + points */}
                        {status === 'scored' && m.home_score_120 != null && (
                          <div className="flex items-center justify-between mt-1 text-xs">
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
          </div>
        ))
      )}
    </div>
  );
}
