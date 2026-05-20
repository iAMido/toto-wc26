import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { Button } from '@/components/ui/button';

/**
 * Placeholder page for routes that haven't been built yet.
 * Shows the route name and a back link.
 * Will be replaced by real pages in Chunks 8-11.
 */
export default function PlaceholderPage({ title }: { title: string }) {
  const { t } = useTranslation();
  const { loading } = useRequireAuth();
  const params = useParams();

  if (loading) return <p className="p-6">{t('common.loading')}</p>;

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      {Object.entries(params).map(([k, v]) => (
        <p key={k} className="text-sm text-muted-foreground">
          {k}: {v}
        </p>
      ))}
      <p className="text-muted-foreground">{t('common.noData')}</p>
      <Link to="/">
        <Button variant="outline">{t('common.back')}</Button>
      </Link>
    </div>
  );
}
