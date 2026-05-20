import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/* ---------- helpers ---------- */

const FINISHED = new Set(['FT', 'AET', 'PEN']);

function fmtTime(iso: string, lang: string) {
  return new Date(iso).toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtShortDate(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/* ---------- types ---------- */

interface Match {
  id: string;
  kickoff_at: string;
  home_team: string;
  away_team: string;
  stage: string;
  status: string;
  home_score_120: number | null;
  away_score_120: number | null;
}

interface MemberPrediction {
  user_id: string;
  display_name: string | null;
  has_predicted: boolean;
  home: number | null;
  away: number | null;
  joker_used: boolean | null;
  advancer_team_id: string | null;
  points: number | null;
}

/* ---------- sub-components ---------- */

/** Single match card with group members' predictions. */
function FeedMatchCard({
  match,
  groupId,
  userId,
  lang,
}: {
  match: Match;
  groupId: string;
  userId: string;
  lang: string;
}) {
  const { t } = useTranslation();

  const { data: preds } = useQuery({
    queryKey: ['group-feed', groupId, match.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_match_predictions_for_group',
        { p_match_id: match.id, p_group_id: groupId },
      );
      if (error) throw error;
      return data as MemberPrediction[];
    },
    staleTime: 30_000,
  });

  const isRevealed = new Date() >= new Date(match.kickoff_at);

  return (
    <Link to={`/match/${match.id}`} className="block">
      <Card className="hover:bg-accent/50 transition-colors">
        <CardContent className="p-3 space-y-2">
          {/* Match header */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {fmtShortDate(match.kickoff_at, lang)} {fmtTime(match.kickoff_at, lang)}{' '}
              &middot; {t(`stages.${match.stage}`, { defaultValue: match.stage.replace('_', ' ') })}
            </span>
            {match.home_score_120 != null && (
              <span className="text-sm font-mono font-bold">
                {match.home_score_120}–{match.away_score_120}
                {match.status !== 'FT' && ` (${match.status})`}
              </span>
            )}
          </div>

          <p className="text-sm font-medium">
            {match.home_team} {t('match.vs')} {match.away_team}
          </p>

          {/* Members' predictions */}
          {preds && preds.length > 0 && (
            <div className="space-y-1 pt-1 border-t">
              {preds.map((p) => (
                <div
                  key={p.user_id}
                  className={`flex items-center text-xs gap-2 ${
                    p.user_id === userId ? 'font-semibold' : ''
                  }`}
                >
                  {/* Avatar */}
                  <span className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold shrink-0">
                    {(p.display_name ?? '?')[0].toUpperCase()}
                  </span>

                  {/* Name */}
                  <span className="truncate flex-1">
                    {p.display_name || p.user_id.slice(0, 8)}
                  </span>

                  {/* Prediction / status */}
                  {p.has_predicted ? (
                    isRevealed || p.user_id === userId ? (
                      <span className="font-mono whitespace-nowrap">
                        {p.home}–{p.away}
                        {p.joker_used && ' 🃏'}
                        {p.points != null && (
                          <span className="text-primary ms-1 font-bold">+{p.points}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400">
                        {t('feed.submitted')} ✓
                      </span>
                    )
                  ) : (
                    <span className="text-muted-foreground italic">
                      {t('feed.pending')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

/* ---------- main feed ---------- */

interface GroupMatchFeedProps {
  groupId: string;
  userId: string;
}

export default function GroupMatchFeed({ groupId, userId }: GroupMatchFeedProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  // Fetch all matches (shared with MatchListPage via React Query cache)
  const { data: allMatches } = useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('kickoff_at', { ascending: true });
      if (error) throw error;
      return data as Match[];
    },
  });

  // Split into upcoming (next 5) and recent (last 5 finished)
  const { upcoming, recent } = useMemo(() => {
    if (!allMatches) return { upcoming: [], recent: [] };

    const now = new Date();
    const up: Match[] = [];
    const rec: Match[] = [];

    for (const m of allMatches) {
      if (FINISHED.has(m.status)) {
        rec.push(m);
      } else if (new Date(m.kickoff_at) > now && m.status === 'NS') {
        up.push(m);
      }
    }

    return {
      upcoming: up.slice(0, 5),
      recent: rec.slice(-5).reverse(), // most recent first
    };
  }, [allMatches]);

  if (!allMatches || allMatches.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t('feed.upcoming')}
          </h2>
          {upcoming.map((m) => (
            <FeedMatchCard
              key={m.id}
              match={m}
              groupId={groupId}
              userId={userId}
              lang={lang}
            />
          ))}
        </div>
      )}

      {/* Recent results */}
      {recent.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t('feed.recent')}
          </h2>
          {recent.map((m) => (
            <FeedMatchCard
              key={m.id}
              match={m}
              groupId={groupId}
              userId={userId}
              lang={lang}
            />
          ))}
        </div>
      )}

      {/* View all link */}
      <div className="text-center">
        <Link to="/matches">
          <Button variant="outline" size="sm">
            {t('feed.viewAll')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
