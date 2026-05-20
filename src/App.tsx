import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RtlProvider } from '@/i18n/RtlProvider';
import LoginPage from '@/pages/LoginPage';
import HomePage from '@/pages/HomePage';
import GroupsPage from '@/pages/GroupsPage';
import GroupDetailPage from '@/pages/GroupDetailPage';
import PlaceholderPage from '@/pages/PlaceholderPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RtlProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<HomePage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/groups/:id" element={<GroupDetailPage />} />
            <Route path="/match/:id" element={<PlaceholderPage title="Match Prediction" />} />
            <Route path="/tournament" element={<PlaceholderPage title="Tournament Predictions" />} />
            <Route path="/leaderboard/:groupId" element={<PlaceholderPage title="Leaderboard" />} />
          </Routes>
        </BrowserRouter>
      </RtlProvider>
    </QueryClientProvider>
  );
}

export default App;
