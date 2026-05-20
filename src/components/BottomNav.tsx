import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/', icon: '🏠', labelKey: 'nav.home' },
  { path: '/matches', icon: '⚽', labelKey: 'nav.matches' },
  { path: '/groups', icon: '👥', labelKey: 'nav.groups' },
  { path: '/tournament', icon: '🏆', labelKey: 'nav.tournament' },
  { path: '/profile', icon: '👤', labelKey: 'profile.title' },
];

const SCROLL_THRESHOLD = 10; // px of scroll before toggling

export default function BottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      const delta = y - lastScrollY.current;

      if (delta > SCROLL_THRESHOLD) {
        // Scrolling down → hide
        setHidden(true);
      } else if (delta < -SCROLL_THRESHOLD) {
        // Scrolling up → show
        setHidden(false);
      }

      lastScrollY.current = y;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Always show nav when route changes
  useEffect(() => {
    setHidden(false);
    lastScrollY.current = window.scrollY;
  }, [location.pathname]);

  return (
    <nav
      className={`bottom-nav ${hidden ? 'nav-hidden' : ''}`}
      role="navigation"
      aria-label="Main navigation"
    >
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
              aria-current={isActive ? 'page' : undefined}
              aria-label={t(item.labelKey)}
            >
              <span className="text-lg" aria-hidden="true">{item.icon}</span>
              <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
