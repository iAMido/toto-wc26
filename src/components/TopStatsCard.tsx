import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import TeamFlag from '@/components/TeamFlag';

/**
 * Top scorers / top assisters card. Two mini-leaderboards side-by-side,
 * each showing the top 3 players. Data is refreshed by the sync-fixtures
 * Edge Function (pg_cron, every 20 min during match hours) — this is
 * read-only.
 */

interface PlayerStat {
  api_player_id: number;
  player_name: string;
  player_name_he: string | null;
  team: string | null;
  goals?: number;
  assists?: number;
}

function MedalIcon({ rank }: { rank: number }) {
  if (rank === 0) return <span aria-hidden="true">🥇</span>;
  if (rank === 1) return <span aria-hidden="true">🥈</span>;
  if (rank === 2) return <span aria-hidden="true">🥉</span>;
  return <span className="text-muted-foreground text-xs tabular-nums">{rank + 1}</span>;
}

function MiniLeaderboard({
  title,
  emoji,
  players,
  metric,
  lang,
  emptyText,
}: {
  title: string;
  emoji: string;
  players: PlayerStat[];
  metric: 'goals' | 'assists';
  lang: string;
  emptyText: string;
}) {
  const playerName = (p: PlayerStat) =>
    lang === 'he' && p.player_name_he ? p.player_name_he : p.player_name;

  return (
    <div className="flex-1 bg-muted/30 border border-border/50 rounded-xl p-3 space-y-2">
      <h3 className="text-xs font-bold flex items-center gap-1.5">
        <span aria-hidden="true">{emoji}</span>
        <span>{title}</span>
      </h3>
      {players.length === 0 ? (
        <p className="text-[10px] text-muted-foreground py-2 text-center">{emptyText}</p>
      ) : (
        <ol className="space-y-1.5">
          {players.slice(0, 3).map((p, i) => {
            const count = metric === 'goals' ? p.goals ?? 0 : p.assists ?? 0;
            return (
              <li
                key={p.api_player_id}
                className="flex items-center gap-2 text-xs"
              >
                <span className="w-4 text-center shrink-0"><MedalIcon rank={i} /></span>
                <TeamFlag team={p.team ?? undefined} size="sm" />
                <span className="flex-1 truncate font-medium">{playerName(p)}</span>
                <span className="font-black text-primary tabular-nums shrink-0">{count}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default function TopStatsCard() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const { data: scorers } = useQuery({
    queryKey: ['top-scorers'],
    queryFn: async (): Promise<PlayerStat[]> => {
      const { data, error } = await supabase
        .from('v_top_scorers')
        .select('*')
        .limit(3);
      if (error) throw error;
      return (data ?? []) as PlayerStat[];
    },
    staleTime: 5 * 60_000, // 5 min — stats refresh ≤ every 20 min on server
  });

  const { data: assisters } = useQuery({
    queryKey: ['top-assisters'],
    queryFn: async (): Promise<PlayerStat[]> => {
      const { data, error } = await supabase
        .from('v_top_assisters')
        .select('*')
        .limit(3);
      if (error) throw error;
      return (data ?? []) as PlayerStat[];
    },
    staleTime: 5 * 60_000,
  });

  // Hide the entire card pre-tournament when there's nothing to show on
  // either side. Once games start, partial data is still useful.
  const empty = (scorers?.length ?? 0) === 0 && (assisters?.length ?? 0) === 0;
  if (empty) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-3 space-y-3">
      <h2 className="text-sm font-bold text-center">
        ⭐ {lang === 'he' ? 'מובילי הטורניר' : 'Tournament Leaders'}
      </h2>
      <div className="flex gap-2">
        <MiniLeaderboard
          title={t('tournament.topScorer')}
          emoji="⚽"
          players={scorers ?? []}
          metric="goals"
          lang={lang}
          emptyText={lang === 'he' ? 'אין נתונים עדיין' : 'No data yet'}
        />
        <MiniLeaderboard
          title={t('tournament.topAssister')}
          emoji="👟"
          players={assisters ?? []}
          metric="assists"
          lang={lang}
          emptyText={lang === 'he' ? 'אין נתונים עדיין' : 'No data yet'}
        />
      </div>
    </div>
  );
}
