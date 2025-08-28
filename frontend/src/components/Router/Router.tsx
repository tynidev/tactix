import React, { Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Auth } from '../Auth/Auth';
import { Navigation } from '../Navigation/Navigation';
import { RootRedirect } from '../RootRedirect';
import UserProfilePage from '../UserProfile/UserProfile';

// Lazy load page components
const CoachAnalyticsPage = React.lazy(() =>
  import('../../pages/CoachAnalyticsPage').then(module => ({ default: module.CoachAnalyticsPage }))
);
const DashboardPage = React.lazy(() =>
  import('../../pages/DashboardPage').then(module => ({ default: module.DashboardPage }))
);
const GamesPage = React.lazy(() => import('../../pages/GamesPage').then(module => ({ default: module.GamesPage })));
const ReviewPage = React.lazy(() => import('../../pages/ReviewPage').then(module => ({ default: module.ReviewPage })));
const TeamDetailPage = React.lazy(() =>
  import('../../pages/TeamDetailPage').then(module => ({ default: module.TeamDetailPage }))
);
const TeamsPage = React.lazy(() => import('../../pages/TeamsPage').then(module => ({ default: module.TeamsPage })));
const PlayerViewsTestPage = React.lazy(() =>
  import('../../pages/PlayerViewsTestPage').then(module => ({ default: module.PlayerViewsTestPage }))
);
const VeoTestParserPage = React.lazy(() =>
  import('../../pages/VeoTestParserPage').then(module => ({ default: module.VeoTestParserPage }))
);

// Loading component
const PageLoader: React.FC = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '50vh',
      fontSize: '16px',
      color: '#666',
    }}
  >
    Loading...
  </div>
);

export const AppRouter: React.FC = () =>
{
  const location = useLocation();

  // Hide navigation when viewing a specific game for analysis
  const hideNavigation = location.pathname.startsWith('/review/') && location.pathname.split('/').length > 2;

  return (
    <div className='dashboard-container'>
      {!hideNavigation && <Navigation />}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path='' element={<RootRedirect />} />
          <Route path='/' element={<RootRedirect />} />
          <Route path='/auth' element={<Auth />} />
          <Route path='/dashboard' element={<DashboardPage />} />
          <Route path='/analytics' element={<CoachAnalyticsPage />} />
          <Route path='/teams' element={<TeamsPage />} />
          <Route path='/team/:teamId' element={<TeamDetailPage />} />
          <Route path='/games' element={<GamesPage />} />
          <Route path='/games/:teamId' element={<GamesPage />} />
          <Route path='/profile' element={<UserProfilePage />} />
          <Route path='/review/:gameId' element={<ReviewPage />} />
          <Route path='/views-test' element={<PlayerViewsTestPage />} />
          <Route path='/veo-test' element={<VeoTestParserPage />} />

          {/* Catch all route - redirect to games, preserving query params */}
          <Route path='*' element={<Navigate to='/games' replace />} />
        </Routes>
      </Suspense>
    </div>
  );
};
