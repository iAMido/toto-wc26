import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RtlProvider } from '@/i18n/RtlProvider';
import BottomNav from '@/components/BottomNav';
import LoginPage from '@/pages/LoginPage';
import HomePage from '@/pages/HomePage';
import GroupsPage from '@/pages/GroupsPage';
import GroupDetailPage from '@/pages/GroupDetailPage';
import MatchListPage from '@/pages/MatchListPage';
import MatchPredictionPage from '@/pages/MatchPredictionPage';
import TournamentPredictionsPage from '@/pages/TournamentPredictionsPage';
import ProfilePage from '@/pages/ProfilePage';
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
  const showNav = location.pathname !== '/login';

  return (
    <>
      <div className={showNav ? 'pb-16' : ''}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/groups/:id" element={<GroupDetailPage />} />
          <Route path="/matches" element={<MatchListPage />} />
          <Route path="/match/:id" element={<MatchPredictionPage />} />
          <Route path="/tournament" element={<TournamentPredictionsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/leaderboard/:groupId" element={<PlaceholderPage title="Leaderboard" />} />
        </Routes>
      </div>
      {showNav && <BottomNav />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RtlProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </RtlProvider>
    </QueryClientProvider>
  );
}

export default App;
