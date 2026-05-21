import { useEffect, useState } from 'react';

/**
 * Cross-platform PWA install detection.
 *
 * - Android Chrome / Edge / Brave / Samsung Internet fire a
 *   `beforeinstallprompt` event we can capture and replay later.
 * - iOS Safari fires NOTHING — install requires the user to tap
 *   Share → Add to Home Screen manually. We detect iOS Safari and
 *   show static instructions.
 * - Anyone who's already installed the app gets `display-mode: standalone`
 *   (or `navigator.standalone === true` on legacy iOS). In that case we
 *   don't surface either prompt.
 */

const DISMISS_KEY = 'installPromptDismissed';

type Outcome = 'accepted' | 'dismissed';
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: Outcome; platform: string }>;
}

export type InstallPromptKind = 'none' | 'android' | 'ios';

export interface InstallPromptState {
  kind: InstallPromptKind;
  /** Fire the native Chrome/Edge install dialog. Only valid when kind === 'android'. */
  triggerInstall: () => Promise<void>;
  dismiss: () => void;
}

export function useInstallPrompt(): InstallPromptState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; }
    catch { return false; }
  });

  // Detect runtime platform once. Safe in a browser env; UA sniffing is
  // unavoidable here because iOS Safari hides itself from feature detection.
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isInIosSafari = isIos && /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  const isStandalone = typeof window !== 'undefined'
    && (window.matchMedia('(display-mode: standalone)').matches
       || (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

  // Catch Chrome/Edge's beforeinstallprompt and stash the event for later.
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const installed = () => setDeferred(null);
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const triggerInstall = async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') {
      setDeferred(null);
    }
  };

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  // Decide which prompt (if any) to surface
  let kind: InstallPromptKind = 'none';
  if (!isStandalone && !dismissed) {
    if (deferred)      kind = 'android';
    else if (isInIosSafari) kind = 'ios';
  }

  return { kind, triggerInstall, dismiss };
}
