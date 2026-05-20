import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function HowToPlayModal({ open, onClose }: Props) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto z-10">
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold">{t('rules.title')}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Intro */}
          <p className="text-sm text-muted-foreground">{t('rules.intro')}</p>

          {/* Match Rules */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <span>⚽</span> {t('rules.matchRulesTitle')}
            </h3>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {['rule1', 'rule2', 'rule3', 'rule4'].map((key) => (
                <li key={key} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  {t(`rules.${key}`)}
                </li>
              ))}
            </ul>
          </div>

          {/* Scoring */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <span>📊</span> {t('rules.scoringTitle')}
            </h3>
            <div className="space-y-1.5">
              {[
                { key: 'scoringExact', pts: '+5', color: 'text-primary' },
                { key: 'scoringDiff', pts: '+3', color: 'text-primary' },
                { key: 'scoringOutcome', pts: '+1', color: 'text-primary' },
                { key: 'scoringWrong', pts: '0', color: 'text-muted-foreground' },
                { key: 'scoringJoker', pts: '×2', color: 'text-amber-400' },
                { key: 'scoringAdvancer', pts: '+2', color: 'text-amber-400' },
              ].map(({ key, pts, color }) => (
                <div key={key} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                  <span className="text-sm text-muted-foreground">{t(`rules.${key}`)}</span>
                  <span className={`text-sm font-bold ${color}`}>{pts}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tournament Picks (outrights) */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <span>🏆</span> {t('rules.tournamentTitle')}
            </h3>
            <p className="text-sm text-muted-foreground">{t('rules.tournamentDesc')}</p>
            <div className="space-y-1.5 pt-1">
              {[
                { key: 'outrightChampion', pts: '+20', icon: '🥇' },
                { key: 'outrightRunnerup', pts: '+15', icon: '🥈' },
                { key: 'outrightScorer',   pts: '+25', icon: '⚽' },
                { key: 'outrightAssister', pts: '+25', icon: '👟' },
              ].map(({ key, pts, icon }) => (
                <div key={key} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-base">{icon}</span>
                    <span>{t(`rules.${key}`)}</span>
                  </span>
                  <span className="text-sm font-bold text-primary tabular-nums">{pts}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Private Leagues */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <span>👥</span> {t('rules.leaguesTitle')}
            </h3>
            <p className="text-sm text-muted-foreground">{t('rules.leaguesDesc')}</p>
          </div>

          {/* Close button */}
          <Button onClick={onClose} className="w-full rounded-xl h-11 font-bold">
            {t('rules.close')}
          </Button>
        </div>
      </div>
    </div>
  );
}
