import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardPage, GamesPage, ReviewPage, TeamsPage } from '../../pages';
import { Navigation } from '../Navigation/Navigation';
import UserProfilePage from '../UserProfile/UserProfile';

export const AppRouter: React.FC = () =>
{
  return (
    <div className='dashboard-container'>
      <Navigation />
      <Routes>
        <Route path='/' element={<Navigate to='/dashboard' replace />} />
        <Route path='/dashboard' element={<DashboardPage />} />
        <Route path='/teams' element={<TeamsPage />} />
        <Route path='/games' element={<GamesPage />} />
        <Route path='/games/:teamId' element={<GamesPage />} />
        <Route path='/profile' element={<UserProfilePage />} />
        <Route path='/review/:gameId' element={<ReviewPage />} />
        {/* Catch all route - redirect to dashboard */}
        <Route path='*' element={<Navigate to='/dashboard' replace />} />
      </Routes>
    </div>
  );
};
