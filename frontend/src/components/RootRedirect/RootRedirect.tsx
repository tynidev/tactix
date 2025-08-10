import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

export const RootRedirect: React.FC = () => {
  const [searchParams] = useSearchParams();
  const teamCode = searchParams.get('teamCode');

  // If teamCode exists, redirect to /games with the teamCode parameter
  if (teamCode) {
    return <Navigate to={`/games?teamCode=${teamCode}`} replace />;
  }

  // Default behavior: redirect to /games
  return <Navigate to="/games" replace />;
};
