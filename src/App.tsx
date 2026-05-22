import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RtlProvider } from '@/i18n/RtlProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import BottomNav from '@/components/BottomNav';
import ErrorBoundary from '@/components/ErrorBoundary';
import LoginPage from '@/pages/LoginPage';
import HomePage from '@/pages/HomePage';
import GroupsPage from '@/pages/GroupsPage';
import GroupDetailPage from '@/pages/GroupDetailPage';
import MatchListPage from '@/pages/MatchListPage';
import MatchPredictionPage from '@/pages/MatchPredictionPage';
import TournamentPredictionsPage from '@/pages/TournamentPredictionsPage';
import ProfilePage from '@/pages/ProfilePage';
import LeaderboardsPage from '@/pages/LeaderboardsPage';
import AdminPage from '@/pages/AdminPage';
import SetupProfilePage from '@/pages/SetupProfilePage';
import JoinGroupPage from '@/pages/JoinGroupPage';
import PlaceholderPage from '@/pages/PlaceholderPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const location = useLocation();
  // Pages outside the main app shell — no bottom nav, no safe-area padding.
  // These are full-bleed onboarding/transition surfaces.
  const isShellHidden =
    location.pathname === '/login'
    || location.pathname === '/setup-profile'
    || location.pathname.startsWith('/join/');
  const showNav = !isShellHidden;

  return (
    <>
      <div className={showNav ? 'pb-safe' : ''}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup-profile" element={<SetupProfilePage />} />
          <Route path="/join/:inviteCode" element={<JoinGroupPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/groups/:id" element={<GroupDetailPage />} />
          <Route path="/matches" element={<MatchListPage />} />
          <Route path="/match/:id" element={<MatchPredictionPage />} />
          <Route path="/tournament" element={<TournamentPredictionsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/leaderboards" element={<LeaderboardsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/leaderboard/:groupId" element={<PlaceholderPage title="Leaderboard" />} />
        </Routes>
      </div>
      {showNav && <BottomNav />}
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RtlProvider>
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </RtlProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
