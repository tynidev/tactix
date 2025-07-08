import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ThemeToggle from '../ThemeToggle/ThemeToggle';

export const Navigation: React.FC = () =>
{
  const { user, signOut } = useAuth();
  const location = useLocation();

  const isActive = (path: string) =>
  {
    if (path === '/dashboard')
    {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className='header-nav'>
      <div className='header-nav-content'>
        <Link to='/dashboard' className='nav-brand'>
          TACTIX
        </Link>

        <ul className='nav-items'>
          <li>
            <Link
              to='/dashboard'
              className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}
            >
              Dashboard
            </Link>
          </li>
          <li>
            <Link
              to='/teams'
              className={`nav-item ${isActive('/teams') ? 'active' : ''}`}
            >
              Teams
            </Link>
          </li>
          <li>
            <Link
              to='/games'
              className={`nav-item ${isActive('/games') ? 'active' : ''}`}
            >
              Games
            </Link>
          </li>
        </ul>

        <div className='user-menu'>
          <span className='user-info'>
            Welcome, {user?.email?.split('@')[0] || 'User'}
          </span>
          <Link
            to='/profile'
            className={`nav-item ${isActive('/profile') ? 'active' : ''}`}
          >
            Profile
          </Link>
          <ThemeToggle />
          <button onClick={signOut} className='btn btn-error btn-sm'>
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
