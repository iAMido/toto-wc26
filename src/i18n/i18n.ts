import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './en.json';
import he from './he.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      he: { translation: he },
    },
    fallbackLng: 'he',
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      // Check localStorage first, then navigator language.
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'toto-wc26-lang',
      caches: ['localStorage'],
    },
  });

export default i18n;
