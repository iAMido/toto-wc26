import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

const PENDING_INVITE_KEY = 'pendingInviteCode';

type Phase = 'checking' | 'unauthed' | 'no_name' | 'joining' | 'ok' | 'not_found' | 'already_member' | 'error';

/**
 * Deep-link group join. URL shape: /join/ABC12345
 *
 * Possible journeys:
 *   - Authed + has display_name → auto-join, redirect to /groups/:id with toast
 *   - Authed + NO display_name → bounce to /setup-profile, code stays in localStorage
 *   - Not authed → stash code, bounce to /login (LoginPage reads localStorage on
 *     auth-state-change and routes back here once signed in)
 *
 * The page itself only renders during the brief auto-join window or to show
 * a failure state ("code not found", "already a member").
 */
export default function JoinGroupPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const { inviteCode: rawCode } = useParams<{ inviteCode: string }>();

  const [phase, setPhase] = useState<Phase>('checking');
  const [groupName, setGroupName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');

  /* ---------- normalise + persist the code immediately ---------- */
  const inviteCode = (rawCode ?? '').trim().toUpperCase();

  useEffect(() => {
    if (!inviteCode) {
      setPhase('not_found');
      return;
    }
    try { localStorage.setItem(PENDING_INVITE_KEY, inviteCode); } catch { /* ignore */ }
  }, [inviteCode]);

  /* ---------- main flow ---------- */
  useEffect(() => {
    if (!inviteCode) return;
    let cancelled = false;

    const run = async () => {
      // 1. Verify the invite code matches a real group (anyone can do this —
      //    groups.select policy allows reading if you're a member, OR via
      //    invite_code lookup. We use a single targeted query).
      const { data: group, error: lookupErr } = await supabase
        .from('groups')
        .select('id, name')
        .eq('invite_code', inviteCode)
        .maybeSingle();

      if (lookupErr) {
        // RLS may reject if not authed — that's not "not found", it's "auth
        // needed". Fall through to auth gate.
      }

      // 2. Require auth before we can do anything else.
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!session?.user) {
        setPhase('unauthed');
        // Small delay so the user sees the message before the redirect
        setTimeout(() => navigate('/login', { replace: true }), 600);
        return;
      }

      // 3. Re-query the group as the authed user (RLS now permissive)
      const { data: realGroup } = await supabase
        .from('groups')
        .select('id, name')
        .eq('invite_code', inviteCode)
        .maybeSingle();

      if (!realGroup) {
        // Fall back to the unauthed lookup if available, but treat as not-found
        if (group) {
          setGroupName(group.name);
        }
        setPhase('not_found');
        try { localStorage.removeItem(PENDING_INVITE_KEY); } catch { /* ignore */ }
        return;
      }
      setGroupName(realGroup.name);

      // 4. Need display_name before joining (so leaderboards show something)
      const { data: row } = await supabase
        .from('users')
        .select('display_name')
        .eq('id', session.user.id)
        .maybeSingle();
      if (cancelled) return;

      if (!row?.display_name) {
        setPhase('no_name');
        setTimeout(() => navigate('/setup-profile', { replace: true }), 800);
        return;
      }

      // 5. Already a member?
      const { data: existing } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('group_id', realGroup.id)
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (existing) {
        setPhase('already_member');
        try { localStorage.removeItem(PENDING_INVITE_KEY); } catch { /* ignore */ }
        setTimeout(() => navigate(`/groups/${realGroup.id}`, { replace: true }), 800);
        return;
      }

      // 6. Insert membership
      setPhase('joining');
      const { error: insertErr } = await supabase
        .from('group_members')
        .insert({ group_id: realGroup.id, user_id: session.user.id });

      if (insertErr) {
        setPhase('error');
        setErrorMsg(t('common.joinFailed'));
        return;
      }

      try { localStorage.removeItem(PENDING_INVITE_KEY); } catch { /* ignore */ }
      setPhase('ok');
      // Brief celebration before redirect
      setTimeout(() => navigate(`/groups/${realGroup.id}`, { replace: true }), 1000);
    };

    run();
    return () => { cancelled = true; };
  }, [inviteCode, navigate]);

  /* ---------- render ---------- */

  const Body = () => {
    switch (phase) {
      case 'checking':
      case 'joining':
        return (
          <>
            <span className="text-5xl block animate-pulse">🔗</span>
            <p className="text-sm text-muted-foreground">
              {lang === 'he' ? 'מצרף אותך לקבוצה...' : 'Joining group...'}
            </p>
          </>
        );
      case 'unauthed':
        return (
          <>
            <span className="text-5xl block">🔐</span>
            <p className="text-sm font-medium">
              {lang === 'he' ? 'התחבר כדי להצטרף' : 'Sign in to join'}
            </p>
            <p className="text-xs text-muted-foreground">
              {lang === 'he' ? 'מעביר אותך לעמוד ההתחברות...' : 'Taking you to the sign-in page...'}
            </p>
          </>
        );
      case 'no_name':
        return (
          <>
            <span className="text-5xl block">👋</span>
            <p className="text-sm font-medium">
              {lang === 'he' ? 'שניה — נסיים את ההגדרות' : "One sec — let's finish setup"}
            </p>
          </>
        );
      case 'ok':
        return (
          <>
            <span className="text-5xl block">🎉</span>
            <p className="text-base font-bold text-primary">
              {lang === 'he' ? `הצטרפת ל-${groupName}!` : `You joined ${groupName}!`}
            </p>
          </>
        );
      case 'already_member':
        return (
          <>
            <span className="text-5xl block">✓</span>
            <p className="text-sm font-medium">
              {lang === 'he' ? `אתה כבר חבר ב-${groupName}` : `You're already in ${groupName}`}
            </p>
          </>
        );
      case 'not_found':
        return (
          <>
            <span className="text-5xl block">🤷</span>
            <p className="text-sm font-medium">
              {lang === 'he' ? 'הקוד הזה לא קיים' : "That invite code doesn't exist"}
            </p>
            <p className="text-xs text-muted-foreground">
              {lang === 'he' ? `קוד: ${inviteCode || '—'}` : `Code: ${inviteCode || '—'}`}
            </p>
            <Button onClick={() => navigate('/groups', { replace: true })} className="rounded-xl mt-2">
              {lang === 'he' ? 'לקבוצות שלי' : 'My groups'}
            </Button>
          </>
        );
      case 'error':
        return (
          <>
            <span className="text-5xl block">⚠️</span>
            <p className="text-sm font-medium text-destructive">
              {t('common.joinFailed')}
            </p>
            <p className="text-xs text-muted-foreground break-words max-w-xs">{errorMsg}</p>
            <Button onClick={() => navigate('/groups', { replace: true })} variant="outline" className="rounded-xl mt-2">
              {t('common.back')}
            </Button>
          </>
        );
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 p-6 text-center">
      <Body />
    </div>
  );
}
