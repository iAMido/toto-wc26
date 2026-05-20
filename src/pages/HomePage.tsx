import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const { user, loading } = useRequireAuth();

  if (loading) return <p className="p-6">{t('common.loading')}</p>;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const toggleLang = () => {
    const next = i18n.language === 'he' ? 'en' : 'he';
    i18n.changeLanguage(next);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold">⚽ {t('app.name')}</h1>
      <p className="text-muted-foreground">
        {t('app.tagline')} — {user?.email}
      </p>

      <nav className="flex flex-col gap-3 w-full max-w-sm">
        <Link to="/groups">
          <Button variant="outline" className="w-full">{t('nav.groups')}</Button>
        </Link>
        <Link to="/tournament">
          <Button variant="outline" className="w-full">{t('nav.tournament')}</Button>
        </Link>
      </nav>

      <div className="flex gap-4 mt-4">
        <button
          onClick={toggleLang}
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {t('nav.switchLang')}
        </button>
        <button
          onClick={handleSignOut}
          className="text-sm text-destructive underline underline-offset-4 hover:text-destructive/80"
        >
          {t('nav.signOut')}
        </button>
      </div>
    </div>
  );
}
