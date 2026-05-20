import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });

    if (authError) {
      setError(authError.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  // Check if already signed in (e.g. returning from magic link).
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) navigate('/', { replace: true });
  });

  const toggleLang = () => {
    const next = i18n.language === 'he' ? 'en' : 'he';
    i18n.changeLanguage(next);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-6 p-6">
      {/* Logo & branding */}
      <div className="text-center space-y-3">
        <span className="text-6xl block">⚽</span>
        <h1 className="text-3xl font-black tracking-tight">{t('app.name')}</h1>
        <p className="text-muted-foreground text-sm max-w-xs">{t('app.tagline')}</p>
      </div>

      {sent ? (
        <div className="bg-card rounded-2xl border border-border p-6 text-center space-y-3 w-full max-w-sm">
          <span className="text-4xl block">✉️</span>
          <p className="text-primary font-medium">{t('auth.linkSent')}</p>
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
              className="text-center rounded-xl bg-muted/50"
            />
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-xl text-center">
                {error}
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full rounded-xl h-11 font-bold">
              {loading ? t('common.loading') : t('auth.sendLink')}
            </Button>
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
