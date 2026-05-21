/**
 * Maps the most common Supabase Auth error messages and status codes to
 * human-readable, localized strings.
 *
 * Supabase returns `AuthError` objects with `.message` (English, technical)
 * and sometimes `.status` / `.code`. Displaying the raw message to Hebrew
 * users is unacceptable UX — this is the translation layer.
 */

import type { AuthError } from '@supabase/supabase-js';

type LocalizedError = {
  he: string;
  en: string;
};

/**
 * Translate a Supabase Auth error into a localized message.
 * Matches against the message text first (Supabase doesn't always set .code),
 * falling back to a generic message in the active language.
 */
export function localizedAuthError(
  err: AuthError | Error | string | null | undefined,
  lang: string,
): string {
  if (!err) return '';

  const msg = typeof err === 'string' ? err : (err.message ?? '');
  const lower = msg.toLowerCase();

  // Mapping: longest/most-specific patterns first
  const patterns: Array<{ test: RegExp; out: LocalizedError }> = [
    {
      test: /rate.?limit|too many requests|email.*exceeded/i,
      out: {
        he: 'נשלחו יותר מדי בקשות. נסה שוב בעוד דקה.',
        en: 'Too many requests. Try again in a minute.',
      },
    },
    {
      test: /invalid.*(email|format)|email.*invalid/i,
      out: {
        he: 'כתובת המייל לא תקינה. בדוק ונסה שוב.',
        en: 'That email address looks wrong. Check and try again.',
      },
    },
    {
      test: /signups? (are )?(disabled|not allowed)/i,
      out: {
        he: 'הרשמות חדשות מושבתות כרגע.',
        en: 'New signups are currently disabled.',
      },
    },
    {
      test: /user not found|no user|invalid.*credentials/i,
      out: {
        he: 'לא נמצאו פרטים תואמים. בדוק את המייל.',
        en: "We couldn't find an account for that email.",
      },
    },
    {
      test: /email.*not.*confirmed/i,
      out: {
        he: 'המייל שלך עוד לא אומת. בדוק את תיבת הדואר.',
        en: 'Your email is not yet verified. Check your inbox.',
      },
    },
    {
      test: /network|fetch failed|failed to fetch|connection/i,
      out: {
        he: 'בעיית רשת. בדוק את החיבור לאינטרנט ונסה שוב.',
        en: 'Network error. Check your connection and try again.',
      },
    },
    {
      test: /token.*(expired|invalid)|link.*expired/i,
      out: {
        he: 'הקישור פג תוקף. בקש קישור חדש.',
        en: 'That link has expired. Please request a new one.',
      },
    },
    {
      test: /password.*(weak|short|requirements)/i,
      out: {
        he: 'הסיסמה חלשה מדי.',
        en: 'Password is too weak.',
      },
    },
  ];

  for (const { test, out } of patterns) {
    if (test.test(lower)) return lang === 'he' ? out.he : out.en;
  }

  // Last-resort: generic copy + the raw message in parentheses for debugging
  return lang === 'he'
    ? `אירעה שגיאה. נסה שוב. (${msg})`
    : `Something went wrong. Try again. (${msg})`;
}
