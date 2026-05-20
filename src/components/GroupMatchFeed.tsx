import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { getFlag, getTeamName } from '@/lib/team-utils';

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
      <div className="bg-muted/30 rounded-xl border border-border/50 p-3 space-y-2 hover:bg-muted/50 transition-colors">
        {/* Match header */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {fmtShortDate(match.kickoff_at, lang)} {fmtTime(match.kickoff_at, lang)}
            {' · '}
            {t(`stages.${match.stage}`, { defaultValue: match.stage.replace('_', ' ') })}
          </span>
          {match.home_score_120 != null && (
            <span className="text-sm font-mono font-bold">
              {match.home_score_120}–{match.away_score_120}
              {match.status !== 'FT' && ` (${match.status})`}
            </span>
          )}
        </div>

        {/* Teams */}
        <div className="flex items-center justify-center gap-3 text-sm">
          <span>{getFlag(match.home_team)}</span>
          <span className="font-medium">{getTeamName(match.home_team, lang)}</span>
          <span className="text-xs text-muted-foreground">vs</span>
          <span className="font-medium">{getTeamName(match.away_team, lang)}</span>
          <span>{getFlag(match.away_team)}</span>
        </div>

        {/* Members' predictions */}
        {preds && preds.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-border/50">
            {preds.map((p) => (
              <div
                key={p.user_id}
                className={`flex items-center text-xs gap-2 ${
                  p.user_id === userId ? 'font-semibold' : ''
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold shrink-0 text-primary">
                  {(p.display_name ?? '?')[0].toUpperCase()}
                </span>
                <span className="truncate flex-1">
                  {p.display_name || p.user_id.slice(0, 8)}
                </span>
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
                    <span className="text-primary text-[10px]">
                      {t('feed.submitted')} ✓
                    </span>
                  )
                ) : (
                  <span className="text-muted-foreground italic text-[10px]">
                    {t('feed.pending')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
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
      recent: rec.slice(-5).reverse(),
    };
  }, [allMatches]);

  if (!allMatches || allMatches.length === 0) return null;

  return (
    <div className="space-y-4">
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-muted-foreground px-1">
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

      {recent.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-muted-foreground px-1">
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

      <div className="text-center">
        <Link to="/matches">
          <Button variant="outline" size="sm" className="rounded-xl">
            {t('feed.viewAll')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
