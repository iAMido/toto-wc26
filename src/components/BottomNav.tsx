import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', icon: '🏠', labelKey: 'nav.home' },
  { path: '/matches', icon: '⚽', labelKey: 'nav.matches' },
  { path: '/groups', icon: '👥', labelKey: 'nav.groups' },
  { path: '/tournament', icon: '🏆', labelKey: 'nav.tournament' },
];

export default function BottomNav() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <nav className="bottom-nav">
      <div className="max-w-lg mx-auto flex justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
