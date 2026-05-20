import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRealtimeMatches } from '@/hooks/useRealtimeMatches';
import { supabase } from '@/lib/supabase';
import InlineMatchCard from '@/components/InlineMatchCard';

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

/* ---------- helpers ---------- */

function isGroupStage(stage: string) {
  return stage.startsWith('GROUP_');
}

function getGroupLetter(stage: string): string {
  return stage.replace('GROUP_', '');
}

/* ---------- component ---------- */

export default function MatchListPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user, loading: authLoading } = useRequireAuth();
  const [phase, setPhase] = useState<Phase>('group');
  const [openStages, setOpenStages] = useState<Set<string>>(new Set());
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

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
        .select('match_id, home, away, joker_used, points, advancer_team_id')
        .eq('user_id', user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Group matches by stage
  const stageGroups = useMemo(() => {
    if (!matches) return [];

    const predMap = new Map(
      (predictions ?? []).map((p) => [p.match_id, p]),
    );

    const filtered = matches.filter((m) =>
      phase === 'group' ? isGroupStage(m.stage) : !isGroupStage(m.stage),
    );

    type PredEntry = { match_id: string; home: number; away: number; joker_used: boolean; points: number | null; advancer_team_id: string | null };
    type StageData = {
      matches: (typeof matches[number])[];
      predictions: Map<string, PredEntry>;
      predicted: number;
      total: number;
    };

    const stageMap = new Map<string, StageData>();

    for (const m of filtered) {
      const entry: StageData = stageMap.get(m.stage) ?? { matches: [], predictions: new Map(), predicted: 0, total: 0 };
      const pred = predMap.get(m.id);
      entry.matches.push(m);
      if (pred) {
        entry.predictions.set(m.id, pred as PredEntry);
        entry.predicted++;
      }
      entry.total++;
      stageMap.set(m.stage, entry);
    }

    const sorted = Array.from(stageMap.entries()).sort(
      ([a], [b]) => (STAGE_ORDER[a] ?? 99) - (STAGE_ORDER[b] ?? 99),
    );

    // Auto-open first group that has open (unpredicted, not locked) matches
    if (openStages.size === 0 && sorted.length > 0) {
      const now = new Date();
      const firstOpen = sorted.find(([, data]) =>
        data.matches.some((m) => {
          const isLocked = now >= new Date(m.kickoff_at) || FINISHED_STATUSES.has(m.status);
          return !isLocked && !data.predictions.has(m.id);
        }),
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
      if (next.has(stage)) {
        next.delete(stage);
        setExpandedMatchId(null); // Collapse any open match card
      } else {
        next.add(stage);
      }
      return next;
    });
  };

  const toggleMatch = (matchId: string) => {
    setExpandedMatchId((prev) => (prev === matchId ? null : matchId));
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
            onClick={() => { setPhase('group'); setOpenStages(new Set()); setExpandedMatchId(null); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              phase === 'group'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('stages.groupPhase')}
          </button>
          <button
            onClick={() => { setPhase('knockout'); setOpenStages(new Set()); setExpandedMatchId(null); }}
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
              const progress = `${data.predicted}/${data.total}`;
              const allDone = data.predicted === data.total;

              return (
                <div key={stage} className="group-accordion">
                  {/* Accordion header */}
                  <button
                    onClick={() => toggleStage(stage)}
                    className="group-accordion-header w-full"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-lg transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}>
                        ▾
                      </span>
                      <div className="text-start">
                        <p className="font-bold text-sm">
                          {t(`stages.${stage}`, { defaultValue: stage.replace('_', ' ') })}
                        </p>
                        <p className={`text-[10px] ${allDone ? 'text-primary' : 'text-muted-foreground'}`}>
                          {progress} {lang === 'he' ? 'ניחושים' : 'predicted'}
                          {allDone && ' ✓'}
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

                  {/* Accordion content — match cards */}
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-2">
                      {data.matches.map((m) => {
                        const pred = data.predictions.get(m.id);
                        return (
                          <InlineMatchCard
                            key={m.id}
                            match={m}
                            prediction={pred ?? undefined}
                            userId={user!.id}
                            expanded={expandedMatchId === m.id}
                            onToggle={() => toggleMatch(m.id)}
                          />
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
