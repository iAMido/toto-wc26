import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { localizedAuthError } from '@/lib/auth-errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Chevron from '@/components/Chevron';

const RESEND_COOLDOWN_SEC = 60;
const PENDING_INVITE_KEY = 'pendingInviteCode';

/**
 * Magic-link sign-in screen. Three notable behaviours:
 *  1. Auth + display_name checks live inside useEffect (NOT every render).
 *  2. If the page was opened with ?invite=CODE, stash the code in
 *     localStorage so we can resume the deep-link join after the user
 *     comes back from their inbox.
 *  3. Localised Supabase auth errors, plus a resend cooldown.
 */
export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);

  /* ---------- 1. Capture any ?invite=CODE for after-signup auto-join ---------- */
  useEffect(() => {
    const invite = searchParams.get('invite');
    if (invite && /^[A-Za-z0-9]{6,12}$/.test(invite)) {
      try { localStorage.setItem(PENDING_INVITE_KEY, invite.toUpperCase()); }
      catch { /* localStorage disabled — ignore, deep-link just won't resume */ }
    }
  }, [searchParams]);

  /* ---------- 2. One-shot auth check on mount (NOT per-render) ---------- */
  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.user) {
        // Already signed in — figure out where to send them next.
        const { data: row } = await supabase
          .from('users')
          .select('display_name')
          .eq('id', session.user.id)
          .maybeSingle();

        const pending = readPendingInvite();
        if (!row?.display_name) {
          navigate('/setup-profile', { replace: true });
        } else if (pending) {
          navigate(`/join/${pending}`, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } else {
        setAuthChecked(true);
      }
    };

    checkAuth();

    // Also react to magic-link return inside the same tab.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (cancelled) return;
        if (session?.user) {
          const { data: row } = await supabase
            .from('users')
            .select('display_name')
            .eq('id', session.user.id)
            .maybeSingle();
          const pending = readPendingInvite();
          if (!row?.display_name) navigate('/setup-profile', { replace: true });
          else if (pending) navigate(`/join/${pending}`, { replace: true });
          else navigate('/', { replace: true });
        }
      },
    );

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [navigate]);

  /* ---------- 3. Resend-link cooldown tick ---------- */
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const id = setInterval(() => setCooldownLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldownLeft]);

  /* ---------- 4. Submit / resend ---------- */
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading || cooldownLeft > 0) return;
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });

    if (authError) {
      setError(localizedAuthError(authError, lang));
    } else {
      setSent(true);
      setCooldownLeft(RESEND_COOLDOWN_SEC);
    }
    setLoading(false);
  };

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'he' ? 'en' : 'he');
  };

  /* ---------- 5. Render ---------- */
  // Keep the page blank while the initial auth check is in flight, so a
  // logged-in user never sees the email form flash before the redirect.
  if (!authChecked) {
    return <div className="min-h-[100dvh] bg-background" />;
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-5 p-6">
      {/* Branding */}
      <div className="text-center space-y-2">
        <span className="text-6xl block">⚽</span>
        <h1 className="text-3xl font-black tracking-tight">{t('app.name')}</h1>
        <p className="text-muted-foreground text-sm max-w-xs">{t('app.tagline')}</p>
      </div>

      {/* Value props — only shown pre-send so we don't crowd the "check your email" state */}
      {!sent && (
        <div className="w-full max-w-sm bg-card/40 rounded-2xl border border-border/40 p-4 space-y-2 text-xs text-muted-foreground">
          <ValueRow icon="🎯" text={lang === 'he' ? 'נחש את כל 104 משחקי המונדיאל' : 'Predict all 104 World Cup matches'} />
          <ValueRow icon="👥" text={lang === 'he' ? 'התחרה מול חברים בקבוצות פרטיות' : 'Compete against friends in private groups'} />
          <ValueRow icon="🃏" text={lang === 'he' ? 'הפעל ג׳וקרים להכפלת נקודות' : 'Use Jokers to double your points'} />
          <ValueRow icon="🏆" text={lang === 'he' ? 'נחש אלופה, מלך שערים ועוד — +20/+25 נק׳' : 'Pick champion, top scorer & more — +20/+25 pts'} />
        </div>
      )}

      {sent ? (
        <div className="bg-card rounded-2xl border border-border p-6 text-center space-y-3 w-full max-w-sm">
          <span className="text-4xl block">✉️</span>
          <p className="text-primary font-bold">{t('auth.linkSent')}</p>
          <p className="text-xs text-muted-foreground" dir="ltr">{email}</p>
          <div className="pt-2 border-t border-border/50">
            <p className="text-[11px] text-muted-foreground mb-2">
              {lang === 'he' ? 'לא קיבלת? בדוק את תיקיית הספאם.' : "Didn't get it? Check your spam folder."}
            </p>
            <button
              onClick={() => handleSubmit()}
              disabled={cooldownLeft > 0 || loading}
              className="text-xs text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
            >
              {cooldownLeft > 0
                ? (lang === 'he' ? `שלח שוב בעוד ${cooldownLeft}ש׳` : `Resend in ${cooldownLeft}s`)
                : (<><Chevron direction="back" className="inline" /> {lang === 'he' ? 'שלח קישור חדש' : 'Send a new link'}</>)}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="text-sm font-medium" htmlFor="email">
              {t('auth.email')}
            </label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              dir="ltr"
              autoComplete="email"
              className="text-center rounded-xl bg-muted/50"
            />
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl text-center" role="alert">
                {error}
              </div>
            )}
            <Button type="submit" disabled={loading || !email} className="w-full rounded-xl h-11 font-bold">
              {loading ? t('common.loading') : t('auth.sendLink')}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              {lang === 'he'
                ? 'נשלח אליך קישור התחברות חד-פעמי. ללא סיסמה.'
                : 'We will email you a one-time sign-in link. No password.'}
            </p>
          </form>
        </div>
      )}

      <button
        onClick={toggleLang}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-muted"
      >
        {t('nav.switchLang')}
      </button>
    </div>
  );
}

function ValueRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-base" aria-hidden="true">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function readPendingInvite(): string | null {
  try {
    return localStorage.getItem(PENDING_INVITE_KEY);
  } catch {
    return null;
  }
}
