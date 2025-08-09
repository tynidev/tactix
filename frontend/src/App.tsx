import React, { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Auth } from './components/Auth/Auth';
import { AppRouter } from './components/Router/Router';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './App.css';

const AppContent: React.FC = () =>
{
  const { user, loading } = useAuth();
  const location = useLocation();

  // Set the theme to light by default
  useEffect(() =>
  {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  if (loading)
  {
    return (
      <div className='app-loading'>
        <div className='loading-spinner'>Loading...</div>
      </div>
    );
  }

  // Check if user is on games page with verified=true (email verification redirect)
  const urlParams = new URLSearchParams(location.search);
  const isEmailVerificationRedirect = location.pathname === '/games' &&
    urlParams.has('verified') &&
    !user;

  // If it's an email verification redirect and user is not authenticated,
  // show a loading screen while Supabase processes the verification
  if (isEmailVerificationRedirect)
  {
    return (
      <div className='app-loading'>
        <div className='loading-spinner'>Completing email verification...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path='/auth' element={<Auth />} />
      <Route path='/*' element={user ? <AppRouter /> : <Auth />} />
    </Routes>
  );
};

function App()
{
  return (
    <AuthProvider>
      <div className='App'>
        <AppContent />
      </div>
    </AuthProvider>
  );
}

export default App;
