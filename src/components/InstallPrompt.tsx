import { useTranslation } from 'react-i18next';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { Button } from '@/components/ui/button';
import Chevron from '@/components/Chevron';

/**
 * Floating card on HomePage that nudges the user to install the PWA.
 *  - On Android Chrome/Edge: surfaces the native install prompt via a
 *    custom button (more visible than waiting for Chrome's mini-infobar).
 *  - On iOS Safari (no install API): shows static "Share → Add to Home
 *    Screen" instructions with the iOS share-icon glyph.
 *  - When already standalone or after dismissal: renders nothing.
 *
 * All copy is bilingual; the card's text dir follows the active i18n lang.
 */
export default function InstallPrompt() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const he = lang === 'he';
  const { kind, triggerInstall, dismiss } = useInstallPrompt();

  if (kind === 'none') return null;

  return (
    <div
      dir={he ? 'rtl' : 'ltr'}
      className="bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/30 rounded-2xl p-4 shadow-lg shadow-primary/10 relative"
      role="dialog"
      aria-label={he ? 'התקנת אפליקציה' : 'Install app'}
    >
      {/* Dismiss button — start corner, language-aware via 'end-2' class */}
      <button
        type="button"
        onClick={dismiss}
        aria-label={he ? 'סגור' : 'Dismiss'}
        className="absolute top-2 end-2 w-7 h-7 rounded-full hover:bg-muted/60 flex items-center justify-center text-muted-foreground text-sm"
      >
        ✕
      </button>

      <div className="flex items-start gap-3 pe-6">
        <span className="text-3xl shrink-0" aria-hidden="true">📱</span>
        <div className="space-y-2 flex-1 min-w-0">
          {kind === 'android' ? (
            <AndroidContent he={he} onInstall={triggerInstall} />
          ) : (
            <IosContent he={he} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Android: native install via deferredPrompt ---------- */

function AndroidContent({ he, onInstall }: { he: boolean; onInstall: () => Promise<void> }) {
  return (
    <>
      <h3 className="text-sm font-bold">
        {he ? 'התקן את האפליקציה' : 'Install the app'}
      </h3>
      <p className="text-xs text-muted-foreground">
        {he
          ? 'גישה מהירה ממסך הבית, חוויית מסך מלא, פעולה במצב לא מקוון.'
          : 'Quick home-screen access, fullscreen experience, offline support.'}
      </p>
      <Button
        onClick={onInstall}
        className="rounded-xl h-9 px-4 text-xs font-bold"
      >
        {he ? 'התקן' : 'Install'} <Chevron direction="forward" className="inline" />
      </Button>
    </>
  );
}

/* ---------- iOS Safari: manual instructions ---------- */

function IosContent({ he }: { he: boolean }) {
  // The iOS Safari share glyph (U+2BAD-ish) — pure unicode, no images.
  // The double-newline preserves visual rhythm when the user scans.
  return (
    <>
      <h3 className="text-sm font-bold">
        {he ? 'הוסף לעמוד הבית באייפון' : 'Add to your iPhone home screen'}
      </h3>
      <ol className="text-xs text-muted-foreground space-y-1.5 list-none ps-0">
        <li className="flex items-start gap-2">
          <span className="font-black text-primary tabular-nums">1.</span>
          <span>
            {he ? 'לחץ על כפתור השיתוף' : 'Tap the Share button'}
            {' '}
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded bg-primary/20 text-primary font-bold align-middle mx-0.5"
              aria-label={he ? 'אייקון השיתוף' : 'Share icon'}
            >
              ⎘
            </span>
            {' '}
            {he ? 'בתחתית הדפדפן.' : 'at the bottom of Safari.'}
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="font-black text-primary tabular-nums">2.</span>
          <span>
            {he ? 'גלול ולחץ ' : 'Scroll down and tap '}
            <span className="font-bold text-foreground">
              {he ? '"הוסף לעמוד הבית"' : '"Add to Home Screen"'}
            </span>.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="font-black text-primary tabular-nums">3.</span>
          <span>
            {he
              ? 'האייקון יופיע במסך הבית — לחץ עליו ותקבל אפליקציה אמיתית.'
              : 'The icon appears on your home screen — tap to launch fullscreen.'}
          </span>
        </li>
      </ol>
    </>
  );
}
