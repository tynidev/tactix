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

  // If user is not authenticated and trying to access a protected route,
  // capture the intended destination and pass it to Auth
  const shouldRedirectToAuth = !user && location.pathname !== '/auth';
  const redirectUrl = shouldRedirectToAuth ? `${location.pathname}${location.search}${location.hash}` : undefined;

  return (
    <Routes>
      <Route path='/auth' element={<Auth />} />
      <Route path='/*' element={user ? <AppRouter /> : <Auth redirectUrl={redirectUrl} />} />
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
