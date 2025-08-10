import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { DashboardPage, GamesPage, ReviewPage, TeamDetailPage, TeamsPage } from '../../pages';
import { Auth } from '../Auth/Auth';
import { Navigation } from '../Navigation/Navigation';
import { RootRedirect } from '../RootRedirect';
import UserProfilePage from '../UserProfile/UserProfile';

export const AppRouter: React.FC = () =>
{
  const location = useLocation();

  // Hide navigation when viewing a specific game for analysis
  const hideNavigation = location.pathname.startsWith('/review/') && location.pathname.split('/').length > 2;

  return (
    <div className='dashboard-container'>
      {!hideNavigation && <Navigation />}
      <Routes>
        <Route path='' element={<RootRedirect />} />
        <Route path='/' element={<RootRedirect />} />
        <Route path='/auth' element={<Auth />} />
        <Route path='/dashboard' element={<DashboardPage />} />
        <Route path='/teams' element={<TeamsPage />} />
        <Route path='/team/:teamId' element={<TeamDetailPage />} />
        <Route path='/games' element={<GamesPage />} />
        <Route path='/games/:teamId' element={<GamesPage />} />
        <Route path='/profile' element={<UserProfilePage />} />
        <Route path='/review/:gameId' element={<ReviewPage />} />
        
        {/* Catch all route - redirect to games, preserving query params */}
        <Route path='*' element={<Navigate to='/games' replace />} />
      </Routes>
    </div>
  );
};
