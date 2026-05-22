import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Chevron from '@/components/Chevron';

const PENDING_INVITE_KEY = 'pendingInviteCode';

/**
 * Forced post-auth setup screen. Cannot be skipped, has no nav — the user
 * MUST pick a display_name before they're allowed anywhere else. Reached
 * via redirect from useRequireAuth when display_name is NULL.
 *
 * After save we resume the user's flow:
 *   - if a pending invite is in localStorage → /join/<CODE>
 *   - otherwise → /
 */
export default function SetupProfilePage() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [authChecked, setAuthChecked] = useState(false);

  /* ---- One-shot auth check ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session?.user) {
        navigate('/login', { replace: true });
        return;
      }
      setEmail(session.user.email ?? '');
      // Pre-fill from auth metadata if any (e.g. email prefix), but the
      // input stays empty if there's nothing useful to suggest.
      const meta = session.user.user_metadata?.display_name as string | undefined;
      if (meta) setName(meta);
      else if (session.user.email) setName(session.user.email.split('@')[0]);

      // If display_name is somehow already set on public.users, skip ahead.
      const { data: row } = await supabase
        .from('users')
        .select('display_name')
        .eq('id', session.user.id)
        .maybeSingle();
      if (row?.display_name) {
        resume(navigate);
        return;
      }
      setAuthChecked(true);
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  // Auto-focus once revealed
  useEffect(() => {
    if (authChecked) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [authChecked]);

  /* ---- Submit ---- */
  const save = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError(lang === 'he' ? 'השם חייב להיות לפחות 2 תווים' : 'Name must be at least 2 characters');
      return;
    }
    if (trimmed.length > 40) {
      setError(lang === 'he' ? 'השם ארוך מדי' : 'Name is too long');
      return;
    }
    setSaving(true);
    setError('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    // Write to both auth metadata (drives header chip) and public.users
    // (drives leaderboards). Both should succeed; if either fails, bail.
    const [authRes, dbRes] = await Promise.all([
      supabase.auth.updateUser({ data: { display_name: trimmed } }),
      supabase.from('users').update({ display_name: trimmed }).eq('id', user.id),
    ]);

    if (authRes.error || dbRes.error) {
      setError(lang === 'he' ? 'שמירה נכשלה. נסה שוב.' : 'Save failed. Try again.');
      setSaving(false);
      return;
    }

    resume(navigate);
  };

  if (!authChecked) {
    return <div className="min-h-[100dvh] bg-background" />;
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-5 p-6">
      <div className="text-center space-y-2">
        <span className="text-5xl block">👋</span>
        <h1 className="text-2xl font-black tracking-tight">
          {lang === 'he' ? 'ברוך הבא!' : 'Welcome!'}
        </h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          {lang === 'he'
            ? 'איך אתה רוצה שיקראו לך בטבלת הדירוג?'
            : 'How should you appear on the leaderboard?'}
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm space-y-4">
        <div>
          <label htmlFor="display_name" className="text-xs text-muted-foreground block mb-1.5">
            {lang === 'he' ? 'שם תצוגה' : 'Display name'}
          </label>
          <Input
            ref={inputRef}
            id="display_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
            maxLength={40}
            placeholder={lang === 'he' ? 'איך נקרא לך?' : 'What should we call you?'}
            className="rounded-xl bg-muted/50 text-center text-lg font-bold h-12"
            aria-label={lang === 'he' ? 'שם תצוגה' : 'Display name'}
          />
          <p className="text-[10px] text-muted-foreground mt-1.5">
            {lang === 'he' ? `מחובר עם ${email}` : `Signed in as ${email}`}
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl text-center" role="alert">
            {error}
          </div>
        )}

        <Button
          onClick={save}
          disabled={saving || name.trim().length < 2}
          className="w-full rounded-xl h-11 font-bold"
        >
          {saving
            ? (lang === 'he' ? 'שומר...' : 'Saving...')
            : (<>{lang === 'he' ? 'בואו נתחיל' : "Let's go"} <Chevron direction="forward" className="inline" /></>)}
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground max-w-sm text-center">
        {lang === 'he'
          ? 'תוכל לשנות את השם בכל זמן מעמוד הפרופיל.'
          : 'You can change this anytime from your profile.'}
      </p>
    </div>
  );
}

/* ---- Resume the user's flow after name is saved ---- */
function resume(navigate: (path: string, opts?: { replace: boolean }) => void) {
  let invite: string | null = null;
  try { invite = localStorage.getItem(PENDING_INVITE_KEY); } catch { /* ignore */ }
  if (invite) {
    navigate(`/join/${invite}`, { replace: true });
  } else {
    navigate('/', { replace: true });
  }
}
