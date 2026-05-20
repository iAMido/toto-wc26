import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const RTL_LANGUAGES = new Set(['he', 'ar']);

/**
 * Syncs <html dir> and <html lang> with the active i18next language.
 * Mount once at the app root — no children needed, purely side-effect.
 */
export function RtlProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();

  useEffect(() => {
    const lang = i18n.language ?? 'he';
    const dir = RTL_LANGUAGES.has(lang) ? 'rtl' : 'ltr';

    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
  }, [i18n.language]);

  // Listen for language changes that happen outside React (e.g. i18n.changeLanguage).
  useEffect(() => {
    const handler = (lang: string) => {
      const dir = RTL_LANGUAGES.has(lang) ? 'rtl' : 'ltr';
      document.documentElement.setAttribute('dir', dir);
      document.documentElement.setAttribute('lang', lang);
    };

    i18n.on('languageChanged', handler);
    return () => {
      i18n.off('languageChanged', handler);
    };
  }, [i18n]);

  return <>{children}</>;
}
